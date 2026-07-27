import { supabase } from '@/lib/supabase'
import { asOptionalUuid } from '@/lib/utils'
import { caseApplicationRepository } from '@/repositories/case-application-repository'
import { caseRepository } from '@/repositories/case-repository'
import { missionRepository } from '@/repositories/mission-repository'
import { volunteerRepository } from '@/repositories/volunteer-repository'
import { caseService } from '@/services/case-service'
import { missionService } from '@/services/mission-service'
import { notifyUser } from '@/lib/notify'
import { operationalLog } from '@/lib/operational-log'
import type { CaseApplicationWithApplicant } from '@/domain/case-application.types'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import type { Mission } from '@/domain/mission.types'

export const caseApplicationService = {
  async listByCase(caseId: string): Promise<CaseApplicationWithApplicant[]> {
    return caseApplicationRepository.listByCase(caseId)
  },

  async findByCaseAndApplicant(caseId: string, applicantId: string) {
    return caseApplicationRepository.findByCaseAndApplicant(caseId, applicantId)
  },

  async apply(caseId: string, applicantId: string, params?: {
    organization?: string
    message?: string
    skills?: string[]
    availability?: string
  }) {
    const existing = await caseApplicationRepository.findByCaseAndApplicant(caseId, applicantId)
    if (existing) return existing

    const app = await caseApplicationRepository.apply(caseId, applicantId, params)
    try {
      const caseData = await caseService.getById(caseId)
      if (caseData) {
        const managers = await getActiveManagers()
        for (const m of managers) {
          await notifyUser(
            m.id,
            'Nuevo postulante',
            `Un voluntario se postuló al caso "${caseData.title}"`,
            'case_application',
            { caseId, applicationId: app.id },
          )
        }
      }
    } catch {
      console.warn('[CASE_APPLICATION] Failed to notify managers after apply')
    }
    return app
  },

  async notifyVolunteersAboutCase(caseData: CaseDomain) {
    try {
      // Unir cercanos + todos los perfiles volunteer (lat=0 no debe excluir a Valeria)
      const nearby = await getActiveVolunteersNear(caseData.location.lat, caseData.location.lng, 50)
      const roster = await getAllActiveVolunteerProfiles()
      const seen = new Set<string>()

      for (const v of [...nearby, ...roster]) {
        if (!v.userId || seen.has(v.userId)) continue
        seen.add(v.userId)
        await notifyUser(
          v.userId,
          'Nueva misión detectada',
          `Se abrió "${caseData.title}" en ${caseData.zone} — ¿quieres postularte?`,
          'case_open',
          { caseId: caseData.id, lat: caseData.location.lat, lng: caseData.location.lng, zone: caseData.zone },
        )
      }
    } catch {
      console.warn('[CASE_APPLICATION] Failed to notify volunteers about case')
    }
  },

  /**
   * Aprobar postulación → caso assigned → misión + assignment → notificación.
   * Idempotente: si un intento previo dejó el caso assigned sin misión
   * (p.ej. 400 en case_events por actor_id vacío), reintentar completa el flujo.
   */
  async approve(applicationId: string, operatorId: string) {
    const actorId = asOptionalUuid(operatorId)
    if (!actorId) {
      throw new Error('Se requiere un operador autenticado para aprobar la postulación')
    }

    const app = await caseApplicationRepository.findById(applicationId)
    if (!app) throw new Error('Postulación no encontrada')
    if (app.status === 'rejected' || app.status === 'withdrawn' || app.status === 'expired') {
      throw new Error('Esta postulación no se puede aprobar')
    }

    if (app.status !== 'approved') {
      await caseApplicationRepository.updateStatus(applicationId, 'approved')
    }

    const caseData = await caseService.getById(app.caseId)
    if (!caseData) throw new Error('Caso no encontrado')

    if (caseData.pipelineStage === 'open_for_applications') {
      await caseService.transition(
        app.caseId,
        'assigned',
        actorId,
        'Postulación aprobada — voluntario asignado al caso',
      )
    } else if (
      caseData.pipelineStage === 'assigned' ||
      caseData.pipelineStage === 'accepted' ||
      caseData.pipelineStage === 'in_attention'
    ) {
      // Recuperación: el caso ya avanzó pero pudo faltar el event / misión.
      await ensureAssignedEvent(app.caseId, actorId)
    } else {
      throw new Error(
        `El caso está en "${caseData.pipelineStage}" y no puede asignarse desde una postulación`,
      )
    }

    const mission = await ensureMissionForApprovedApplication({
      caseData,
      skills: app.skills ?? [],
      actorId,
      applicantProfileId: app.applicantId,
    })

    await notifyUser(
      app.applicantId,
      'Has sido seleccionado para esta misión',
      `Fuiste seleccionado para "${caseData.title}". Abre FARO e inicia la misión.`,
      'case_approved',
      { caseId: app.caseId, missionId: mission.id },
    )

    operationalLog({
      entityType: 'application',
      entityId: applicationId,
      action: 'approve',
      from: 'open_for_applications',
      to: 'assigned',
      actorId,
      volunteerId: app.applicantId,
      source: 'service',
      payload: { caseId: app.caseId, missionId: mission.id },
    })

    return { caseId: app.caseId, missionId: mission.id }
  },

  async reject(applicationId: string, operatorId: string) {
    const actorId = asOptionalUuid(operatorId)
    if (!actorId) {
      throw new Error('Se requiere un operador autenticado para rechazar la postulación')
    }

    const app = await caseApplicationRepository.findById(applicationId)
    if (!app) throw new Error('Postulación no encontrada')

    await caseApplicationRepository.updateStatus(applicationId, 'rejected')

    // Sin transition: el grafo no permite open_for_applications → open_for_applications
    // ni assigned → open_for_applications. El rechazo solo afecta la postulación.
    await notifyUser(
      app.applicantId,
      'Postulación rechazada',
      'Tu postulación fue rechazada. El caso sigue abierto a otros voluntarios.',
      'case_rejected',
      { caseId: app.caseId, rejectedBy: actorId },
    )
  },
}

async function ensureAssignedEvent(caseId: string, actorId: string) {
  try {
    const events = await caseRepository.listEvents(caseId)
    const hasAssigned = events.some(
      (e) => e.eventType === 'case_assigned' || (e.toStage === 'assigned' && e.eventType !== 'case_submitted'),
    )
    if (hasAssigned) return
    await caseRepository.addEvent({
      caseId,
      eventType: 'case_assigned',
      fromStage: 'open_for_applications',
      toStage: 'assigned',
      actorId,
      comment: 'Postulación aprobada — voluntario asignado al caso',
    })
  } catch (err) {
    console.warn('[CASE_APPLICATION] No se pudo registrar case_assigned en recuperación', err)
  }
}

async function ensureMissionForApprovedApplication(input: {
  caseData: CaseDomain
  skills: string[]
  actorId: string
  applicantProfileId: string
}): Promise<Mission> {
  const existing = await missionRepository.findByCaseId(input.caseData.id)
  const volunteerId = await volunteerRepository.ensureIdForUser(input.applicantProfileId)

  if (existing) {
    const assignments = await missionRepository.listAssignments(existing.id)
    const alreadyAssigned = assignments.some((a) => a.volunteerId === volunteerId)
    if (!alreadyAssigned) {
      await missionService.assignVolunteer(existing.id, volunteerId, input.actorId)
    }
    return existing
  }

  const created = await missionService.create({
    centerId: 'volunteer_pool',
    title: input.caseData.title,
    description: input.caseData.description,
    priority: input.caseData.priority,
    requiredSkills: input.skills,
    requiredPeople: 1,
    location: {
      lat: input.caseData.location.lat,
      lng: input.caseData.location.lng,
      zone: input.caseData.zone,
    },
    caseId: input.caseData.id,
    createdBy: input.actorId,
  })

  await missionService.assignVolunteer(created.mission.id, volunteerId, input.actorId)
  return created.mission
}

interface NearbyVolunteer {
  userId: string
  fullName: string
  phone?: string
  distanceKm: number
}

/** El RPC devuelve columnas en snake_case; sin mapearlas el `userId` era undefined. */
async function getActiveVolunteersNear(lat: number, lng: number, radiusKm: number): Promise<NearbyVolunteer[]> {
  try {
    const { data } = await supabase.rpc('get_volunteers_near_location', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
    })
    const rows = (data ?? []) as { user_id: string; full_name: string; phone: string | null; distance_km: number }[]
    return rows
      .filter((row) => Boolean(row.user_id))
      .map((row) => ({
        userId: row.user_id,
        fullName: row.full_name,
        phone: row.phone ?? undefined,
        distanceKm: row.distance_km,
      }))
  } catch {
    return []
  }
}

async function getAllActiveVolunteerProfiles(): Promise<NearbyVolunteer[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'volunteer')
      .eq('status', 'active')
    return ((data ?? []) as { id: string; full_name: string | null }[]).map((row) => ({
      userId: row.id,
      fullName: row.full_name ?? 'Voluntario',
      distanceKm: 0,
    }))
  } catch {
    return []
  }
}

async function getActiveManagers() {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['case_manager', 'coordinator', 'regional_admin', 'super_admin'])
    return (data ?? []) as { id: string }[]
  } catch {
    return []
  }
}
