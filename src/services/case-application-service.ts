import { supabase } from '@/lib/supabase'
import { asOptionalUuid } from '@/lib/utils'
import { caseApplicationRepository } from '@/repositories/case-application-repository'
import { caseRepository } from '@/repositories/case-repository'
import { missionRepository } from '@/repositories/mission-repository'
import { publicNeedRepository } from '@/repositories/public-need-repository'
import { volunteerRepository } from '@/repositories/volunteer-repository'
import { caseService } from '@/services/case-service'
import { missionService } from '@/services/mission-service'
import { prepareMissionWithReservation } from '@/services/logistics-service'
import { notifyUser } from '@/lib/notify'
import { missionLog } from '@/lib/operational-log'
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
    missionLog('application_received', {
      entityId: app.id,
      volunteerId: applicantId,
      payload: { caseId },
    })
    try {
      const caseData = await caseService.getById(caseId)
      if (caseData) {
        const managers = await getActiveManagers()
        const applicantName =
          (await getApplicantDisplayName(applicantId)) ?? 'Un voluntario'
        for (const m of managers) {
          await notifyUser(
            m.id,
            'Nuevo postulante',
            `${applicantName} quiere ayudar en "${caseData.title}"`,
            'case_application',
            {
              caseId,
              applicationId: app.id,
              applicant_name: applicantName,
            },
            {
              priority: 'high',
              actionUrl: `tab:case-manager:application:${caseId}:${app.id}`,
              icon: 'users',
            },
          )
        }
      }
    } catch {
      console.warn('[FARO_MISSION] Failed to notify managers after apply')
    }
    return app
  },

  async notifyVolunteersAboutCase(caseData: CaseDomain) {
    try {
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
      console.warn('[FARO_MISSION] Failed to notify volunteers about case')
    }
  },

  /**
   * Aprobar postulación → misión+assignment → caso assigned → cerrar radar → notificación.
   * Orden crítico: crear misión ANTES de cambiar el caso, para no dejar estados parciales.
   * Idempotente: si un intento previo dejó approved/assigned sin misión, reintentar completa el flujo.
   */
  async approve(applicationId: string, operatorId: string, pickupCenterId?: string) {
    const actorId = asOptionalUuid(operatorId)
    if (!actorId) {
      throw new Error('Se requiere un operador autenticado para aprobar la postulación')
    }

    const app = await caseApplicationRepository.findById(applicationId)
    if (!app) throw new Error('Postulación no encontrada')
    if (app.status === 'rejected' || app.status === 'withdrawn' || app.status === 'expired') {
      throw new Error('Esta postulación no se puede aprobar')
    }

    const caseData = await caseService.getById(app.caseId)
    if (!caseData) throw new Error('Caso no encontrado')

    const stage = caseData.pipelineStage
    const canAssign =
      stage === 'open_for_applications' ||
      stage === 'assigned' ||
      stage === 'accepted' ||
      stage === 'in_attention'

    if (!canAssign) {
      throw new Error(
        `El caso está en "${stage}" y no puede asignarse desde una postulación`,
      )
    }

    const volunteerId = await volunteerRepository.ensureIdForUser(app.applicantId)

    // 1) Crear misión + assignment PRIMERO (falla aquí = caso sigue esperando postulantes)
    const mission = await ensureMissionForApprovedApplication({
      caseData,
      skills: app.skills ?? [],
      actorId,
      applicantProfileId: app.applicantId,
      pickupCenterId,
    })

    // 1b) Mision de recursos: reservar inventario y completar mision con centro de recogida
    if (caseData.operationType === 'transfer') {
      const logistics = caseData.metadata?.logistics as
        | { originCenterId?: string; resourceType?: string; quantity?: number }
        | undefined
      const resourceType = logistics?.resourceType ?? caseData.category ?? 'agua'
      const quantity = Math.max(1, logistics?.quantity ?? caseData.affectedCount ?? 1)
      const centerId = pickupCenterId ?? logistics?.originCenterId
      if (centerId) {
        await prepareMissionWithReservation({
          mission,
          caseId: app.caseId,
          centerId,
          resourceType,
          quantity,
          volunteerId,
          actorId,
        })
      }
    }

    missionLog('application_accepted', {
      entityId: applicationId,
      actorId,
      volunteerId: app.applicantId,
      from: stage,
      to: 'assigned',
      payload: { caseId: app.caseId, missionId: mission.id },
    })

    // 2) Transicionar caso a assigned
    if (stage === 'open_for_applications') {
      await caseService.transition(
        app.caseId,
        'assigned',
        actorId,
        'Postulación aprobada — voluntario asignado al caso',
      )
    } else {
      await ensureAssignedEvent(app.caseId, actorId)
    }

    // 3) Marcar postulación aprobada + rechazar el resto
    if (app.status !== 'approved') {
      await caseApplicationRepository.updateStatus(applicationId, 'approved')
    }
    await rejectSiblingApplications(app.caseId, applicationId)

    // 4) Cerrar radar (convocatoria) — no completa la necesidad hasta validación
    await closeRadarForCase(app.caseId)

    // 5) Notificar voluntario — abre modal de misión asignada
    await notifyUser(
      app.applicantId,
      'Has sido seleccionado para esta misión',
      `Fuiste seleccionado para "${caseData.title}". Abre FARO e inicia la misión.`,
      'case_approved',
      { caseId: app.caseId, missionId: mission.id },
      {
        priority: 'high',
        actionUrl: `tab:map:mission-assigned:${mission.id}`,
        icon: 'flag',
      },
    )

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

    await notifyUser(
      app.applicantId,
      'Postulación rechazada',
      'Tu postulación fue rechazada. El caso sigue abierto a otros voluntarios.',
      'case_rejected',
      { caseId: app.caseId, rejectedBy: actorId },
    )
  },
}

async function closeRadarForCase(caseId: string) {
  try {
    const needs = await publicNeedRepository.listByCaseId(caseId)
    for (const need of needs) {
      if (need.callStatus === 'open') {
        await publicNeedRepository.updateCallStatus({
          publicNeedId: need.id,
          callStatus: 'closed',
        })
        missionLog('waiting_for_applications', {
          entityId: need.id,
          entityType: 'public_need',
          to: 'closed',
          payload: { caseId, action: 'radar_closed_on_accept' },
        })
      }
    }
  } catch (err) {
    console.warn('[FARO_MISSION] No se pudo cerrar el radar tras aceptar', err)
  }
}

async function rejectSiblingApplications(caseId: string, approvedId: string) {
  try {
    const apps = await caseApplicationRepository.listByCase(caseId)
    await Promise.all(
      apps
        .filter((a) => a.id !== approvedId && (a.status === 'pending' || a.status === 'under_review'))
        .map((a) => caseApplicationRepository.updateStatus(a.id, 'rejected')),
    )
  } catch (err) {
    console.warn('[FARO_MISSION] No se pudieron rechazar postulaciones hermanas', err)
  }
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
    console.warn('[FARO_MISSION] No se pudo registrar case_assigned en recuperación', err)
  }
}

async function ensureMissionForApprovedApplication(input: {
  caseData: CaseDomain
  skills: string[]
  actorId: string
  applicantProfileId: string
  pickupCenterId?: string
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
      address: input.caseData.location.address,
      zone: input.caseData.zone,
    },
    caseId: input.caseData.id,
    createdBy: input.actorId,
    pickupCenterId: input.pickupCenterId,
  })

  missionLog('mission_created', {
    entityId: created.mission.id,
    actorId: input.actorId,
    volunteerId: input.applicantProfileId,
    payload: { caseId: input.caseData.id },
  })

  const { pipelineLog } = await import('@/lib/operational-log')
  pipelineLog('mission_created', {
    entityId: created.mission.id,
    entityType: 'mission',
    actorId: input.actorId,
    volunteerId: input.applicantProfileId,
    payload: { caseId: input.caseData.id },
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
      .in('role', ['case_manager', 'regional_admin', 'super_admin'])
      .eq('status', 'active')
    return (data ?? []) as { id: string }[]
  } catch {
    return []
  }
}

async function getApplicantDisplayName(profileId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', profileId)
      .maybeSingle()
    return (data as { full_name: string | null } | null)?.full_name ?? null
  } catch {
    return null
  }
}
