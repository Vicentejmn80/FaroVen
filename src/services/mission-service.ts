import { missionRepository, type MissionFilters } from '@/repositories/mission-repository'
import { transitionMission, canTransitionMission } from '@/domain/mission.service'
import type { Mission, MissionAssignment, MissionEvent, MissionStage, TransitionResult } from '@/domain/mission.types'
import { MISSION_STAGES } from '@/domain/mission.types'
import {
  operationalIntelligenceService,
  type VolunteerDispatchAction,
} from '@/services/operational-intelligence-service'
import { caseService } from '@/services/case-service'
import { supabase } from '@/lib/supabase'
import { volunteerRepository } from '@/repositories/volunteer-repository'
import {
  notifyVolunteer,
  notifyMissionOperators,
  type MissionNoticeEvent,
} from '@/services/mission-notification-service'

async function emitAssignmentStatus(
  assignment: MissionAssignment,
  action: VolunteerDispatchAction,
  detail: string,
) {
  await operationalIntelligenceService.emitVolunteerDispatchEvent({
    action,
    missionId: assignment.missionId,
    volunteerId: assignment.volunteerId,
    detail,
  })
}

/**
 * Avisa a las audiencias de un paso del motor de ejecución. El evento del
 * timeline lo escribe `advanceMissionStage`; aquí solo se notifica, y un fallo
 * jamás debe tumbar la transición que lo originó.
 */
async function announce(
  assignment: MissionAssignment,
  event: MissionNoticeEvent,
  audience: { volunteer?: boolean; operators?: boolean } = { operators: true },
) {
  try {
    const mission = await missionRepository.findById(assignment.missionId)
    if (!mission) return
    const identity = await volunteerRepository.findIdentity(assignment.volunteerId)

    if (audience.volunteer) {
      await notifyVolunteer({
        volunteerId: assignment.volunteerId,
        volunteerName: identity?.fullName,
        missionId: mission.id,
        missionTitle: mission.title,
        event,
      })
    }
    if (audience.operators) {
      await notifyMissionOperators({
        missionId: mission.id,
        missionTitle: mission.title,
        volunteerName: identity?.fullName,
        event,
        excludeUserId: identity?.userId,
      })
    }
  } catch {
    console.warn('[MISSION_ENGINE] No se pudo publicar el evento', event)
  }
}

const EXECUTION_PATH: MissionStage[] = [
  MISSION_STAGES.CREATED,
  MISSION_STAGES.MATCHING,
  MISSION_STAGES.ASSIGNED,
  MISSION_STAGES.ACCEPTED,
  MISSION_STAGES.EN_ROUTE,
  MISSION_STAGES.ON_SITE,
  MISSION_STAGES.IN_PROGRESS,
  MISSION_STAGES.COMPLETED,
  MISSION_STAGES.VERIFIED,
]

/**
 * Avanza la misión hasta `toStage` caminando el grafo.
 * Si un salto intermedio no es legal (p.ej. assigned→en_route), fuerza el update
 * para que misión y assignment no queden desfasados.
 */
async function advanceMissionStage(missionId: string, toStage: MissionStage, actorId?: string) {
  let mission = await missionRepository.findById(missionId)
  if (!mission || mission.status === toStage) return
  if (mission.status === MISSION_STAGES.CANCELLED || mission.status === MISSION_STAGES.ARCHIVED) return

  const targetIdx = EXECUTION_PATH.indexOf(toStage)
  if (targetIdx < 0) return

  let guard = 0
  while (mission.status !== toStage && guard++ < 12) {
    const currentIdx = EXECUTION_PATH.indexOf(mission.status)
    const next: MissionStage =
      currentIdx >= 0 && currentIdx < targetIdx
        ? EXECUTION_PATH[currentIdx + 1] === MISSION_STAGES.MATCHING && targetIdx > EXECUTION_PATH.indexOf(MISSION_STAGES.ASSIGNED)
          ? MISSION_STAGES.ASSIGNED
          : EXECUTION_PATH[currentIdx + 1]!
        : toStage

    try {
      const check = canTransitionMission(mission, next)
      if (check.allowed) {
        const result = transitionMission(mission, next, actorId)
        await missionRepository.update(missionId, result.mission)
        await missionRepository.addEvent({
          missionId,
          eventType: result.event.eventType,
          actorId,
          description: result.event.description ?? `Misión avanzó a ${next}`,
        })
        mission = result.mission
        continue
      }
    } catch {
      // fall through to force
    }

    const forced: Partial<Mission> = {
      status: next,
      updatedAt: new Date(),
    }
    if (next === MISSION_STAGES.COMPLETED) forced.completedAt = new Date()
    if (next === MISSION_STAGES.VERIFIED) forced.verifiedAt = new Date()
    mission = await missionRepository.update(missionId, forced)
    await missionRepository.addEvent({
      missionId,
      eventType: next === MISSION_STAGES.VERIFIED ? 'mission_verified' : next === MISSION_STAGES.COMPLETED ? 'mission_completed' : 'volunteer_assigned',
      actorId,
      description: `Misión sincronizada a ${next}`,
    })
  }
}

export interface CreateMissionParams {
  centerId: string
  title: string
  description?: string
  priority?: string
  requiredSkills: string[]
  requiredPeople: number
  location: { lat: number; lng: number; address?: string; zone?: string }
  supportRequestId?: string
  caseId?: string
  deadline?: Date
  createdBy: string
}

export const missionService = {
  async create(params: CreateMissionParams): Promise<TransitionResult> {
    const mission = await missionRepository.create(params)

    const event = await missionRepository.addEvent({
      missionId: mission.id,
      eventType: 'mission_created',
      actorId: params.createdBy,
      description: `Misión creada: ${params.title}`,
    })

    return { mission, event }
  },

  async startMatching(missionId: string, actorId?: string): Promise<TransitionResult> {
    const mission = await missionRepository.findById(missionId)
    if (!mission) throw new Error(`Misión no encontrada: ${missionId}`)

    const result = transitionMission(mission, MISSION_STAGES.MATCHING, actorId)
    await missionRepository.update(missionId, result.mission)
    await missionRepository.addEvent({
      missionId,
      eventType: result.event.eventType,
      actorId,
      description: result.event.description,
    })

    return result
  },

  async transition(
    missionId: string,
    toStage: MissionStage,
    actorId?: string,
    actorName?: string,
    comment?: string,
  ): Promise<TransitionResult> {
    const mission = await missionRepository.findById(missionId)
    if (!mission) throw new Error(`Misión no encontrada: ${missionId}`)

    const check = canTransitionMission(mission, toStage)
    if (!check.allowed) throw new Error(check.reason)

    const result = transitionMission(mission, toStage, actorId, actorName, comment)

    await missionRepository.update(missionId, result.mission)
    await missionRepository.addEvent({
      missionId,
      eventType: result.event.eventType,
      actorId,
      actorName,
      description: comment,
    })

    return result
  },

  async assignVolunteer(missionId: string, volunteerId: string, actorId?: string): Promise<MissionAssignment> {
    const assignment = await missionRepository.createAssignment({ missionId, volunteerId })
    const mission = await missionRepository.findById(missionId)
    await announce(assignment, 'volunteer_assigned', { volunteer: true, operators: false })
    if (mission) {
      if (mission.status === MISSION_STAGES.CREATED || mission.status === MISSION_STAGES.MATCHING) {
        const result = transitionMission(mission, MISSION_STAGES.ASSIGNED, actorId)
        await missionRepository.update(missionId, { ...result.mission, assignedPeople: (mission.assignedPeople ?? 0) + 1 })
        await missionRepository.addEvent({
          missionId,
          eventType: result.event.eventType,
          actorId,
          description: 'Voluntario asignado a la misión',
        })
        return assignment
      }
      await missionRepository.update(missionId, {
        assignedPeople: (mission.assignedPeople ?? 0) + 1,
      } as Partial<Mission>)
    }
    const identity = await volunteerRepository.findIdentity(volunteerId)
    await missionRepository.addEvent({
      missionId,
      eventType: 'volunteer_assigned',
      actorId,
      actorName: identity?.fullName,
      description: `${identity?.fullName ?? 'Voluntario'} asignado a la misión`,
    })
    return assignment
  },

  async list(filters?: MissionFilters): Promise<Mission[]> {
    return missionRepository.list(filters)
  },

  async getById(id: string): Promise<Mission | null> {
    return missionRepository.findById(id)
  },

  async getTimeline(missionId: string): Promise<MissionEvent[]> {
    return missionRepository.listEvents(missionId)
  },

  async getAssignments(missionId: string): Promise<MissionAssignment[]> {
    return missionRepository.listAssignments(missionId)
  },

  async listByCenter(centerId: string): Promise<Mission[]> {
    return missionRepository.list({ centerId })
  },

  async listByVolunteer(volunteerId: string): Promise<MissionAssignment[]> {
    return missionRepository.listAssignmentsByVolunteer(volunteerId)
  },

  async acceptAssignment(assignmentId: string, _volunteerId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'accepted',
      respondedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'accepted', 'El voluntario aceptó la asignación')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.ACCEPTED, _volunteerId)
    await announce(updated, 'volunteer_accepted')
    return updated
  },

  async rejectAssignment(assignmentId: string, _volunteerId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'rejected',
      respondedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'assignment_rejected', 'El voluntario rechazó la asignación')
    await missionRepository.addEvent({
      missionId: updated.missionId,
      eventType: 'volunteer_rejected',
      description: 'El voluntario rechazó la misión',
      metadata: { assignmentId },
    })
    await announce(updated, 'volunteer_rejected', { volunteer: true, operators: true })
    return updated
  },

  async markEnRoute(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'en_route',
    })
    await emitAssignmentStatus(updated, 'en_route', 'El voluntario está en camino')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.EN_ROUTE)
    await announce(updated, 'volunteer_en_route', { volunteer: true, operators: true })
    return updated
  },

  async markOnSite(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'on_site',
      arrivedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'on_site', 'El voluntario llegó al sitio')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.ON_SITE)
    await announce(updated, 'volunteer_on_site', { volunteer: true, operators: true })
    return updated
  },

  async markCompleted(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'completed',
      completedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'completed', 'El voluntario finalizó la operación')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.COMPLETED)
    await announce(updated, 'mission_completed', { volunteer: true, operators: true })
    return updated
  },

  async markPreparing(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'preparing',
      preparingAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'preparing', 'El voluntario se está preparando')
    await missionRepository.addEvent({
      missionId: updated.missionId,
      eventType: 'volunteer_preparing',
      description: 'El voluntario se está preparando',
      metadata: { assignmentId },
    })
    await announce(updated, 'volunteer_preparing')
    return updated
  },

  async markInProgress(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'in_progress',
    })
    await emitAssignmentStatus(updated, 'in_progress', 'La operación está en progreso')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.IN_PROGRESS)
    await announce(updated, 'mission_in_progress')
    return updated
  },

  async submitEvidence(
    assignmentId: string,
    missionId: string,
    volunteerId: string,
    evidenceUrls: string[],
  ): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      evidenceUrls,
    })
    await missionRepository.addEvent({
      missionId,
      eventType: 'evidence_submitted',
      actorId: volunteerId,
      description: `Evidencia adjunta (${evidenceUrls.length} archivo(s))`,
      metadata: { evidenceUrls, assignmentId },
    })
    await emitAssignmentStatus(updated, 'evidence_submitted', `${evidenceUrls.length} archivo(s) de evidencia`)
    await announce(updated, 'evidence_submitted')
    return updated
  },

  /**
   * Cierre de la misión por parte del gestor. `verifiedBy` es el usuario que
   * valida la evidencia: la auditoría depende de que no sea el propio ejecutor.
   */
  async verifyAssignment(assignmentId: string, verifiedBy: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'verified',
      verifiedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'verified', 'Operación verificada por el coordinador')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.VERIFIED, verifiedBy)
    await announce(updated, 'mission_verified', { volunteer: true, operators: true })

    const mission = await missionRepository.findById(updated.missionId)
    if (mission?.caseId) {
      try {
        await resolveCaseBestEffort(mission.caseId, verifiedBy, 'Misión validada — caso resuelto')
      } catch {
        // La transición puede no estar permitida desde la etapa actual.
      }

      const recorded = await recordSuccessCase({
        mission,
        verifiedBy,
        volunteerId: updated.volunteerId,
        evidenceUrls: updated.evidenceUrls,
        durationMinutes: durationInMinutes(mission.createdAt, updated.completedAt ?? mission.completedAt),
        responseMinutes: durationInMinutes(mission.createdAt, updated.respondedAt),
      })
      if (recorded) await announce(updated, 'success_case_created', { volunteer: true, operators: true })
    }

    return updated
  },

  /**
   * Cuando el gestor resuelve el caso desde el hub, cierra assignments/misiones
   * ligadas para que el modal del voluntario salga de "esperando validación".
   */
  async closeForResolvedCase(caseId: string, actorId?: string): Promise<void> {
    const missions = await missionRepository.listByCaseId(caseId)
    for (const mission of missions) {
      if (mission.status === MISSION_STAGES.CANCELLED || mission.status === MISSION_STAGES.ARCHIVED) continue

      const assignments = await missionRepository.listAssignments(mission.id)
      for (const assignment of assignments) {
        if (
          assignment.status === 'verified' ||
          assignment.status === 'rejected' ||
          assignment.status === 'cancelled' ||
          assignment.status === 'archived'
        ) {
          continue
        }

        let current = assignment
        if (current.status !== 'completed') {
          current = await missionRepository.updateAssignment(current.id, {
            status: 'completed',
            completedAt: current.completedAt ?? new Date(),
          })
        }

        current = await missionRepository.updateAssignment(current.id, {
          status: 'verified',
          verifiedAt: new Date(),
        })
        await announce(current, 'mission_verified', { volunteer: true, operators: true })
      }

      await advanceMissionStage(mission.id, MISSION_STAGES.VERIFIED, actorId)
    }

    try {
      const { data: needs } = await supabase.from('public_needs').select('id, call_status').eq('case_id', caseId)
      for (const need of needs ?? []) {
        if ((need as { call_status: string }).call_status === 'open') {
          await supabase
            .from('public_needs')
            .update({ call_status: 'complete', visibility_status: 'hidden', status: 'completed' })
            .eq('id', (need as { id: string }).id)
        }
      }
    } catch {
      console.warn('[MISSION_ENGINE] No se pudo cerrar convocatoria al resolver caso')
    }
  },
}

async function resolveCaseBestEffort(caseId: string, actorId: string | undefined, comment: string) {
  const existing = await caseService.getById(caseId)
  if (!existing || existing.pipelineStage === 'resolved' || existing.pipelineStage === 'archived') return

  const stage = existing.pipelineStage
  const paths: Record<string, Array<'assigned' | 'accepted' | 'in_attention' | 'resolved'>> = {
    assigned: ['accepted', 'in_attention', 'resolved'],
    accepted: ['in_attention', 'resolved'],
    in_attention: ['resolved'],
    open_for_applications: ['assigned', 'accepted', 'in_attention', 'resolved'],
  }
  const path = paths[stage]
  if (!path) return

  for (const next of path) {
    try {
      await caseService.transition(caseId, next, actorId, comment)
    } catch {
      // Continuar: otra ruta puede haber avanzado el caso.
    }
  }
}

function durationInMinutes(from?: Date, to?: Date): number | null {
  if (!from || !to) return null
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000))
}

/**
 * Registra el caso de éxito. `public_need_id` es opcional pero se resuelve a
 * partir del caso cuando existe, para conservar la trazabilidad completa.
 */
async function recordSuccessCase(input: {
  mission: Mission
  verifiedBy: string
  volunteerId: string
  evidenceUrls: string[]
  durationMinutes: number | null
  responseMinutes: number | null
}): Promise<boolean> {
  const { mission } = input
  try {
    const { data: need } = await supabase
      .from('public_needs')
      .select('id, category')
      .eq('case_id', mission.caseId ?? '')
      .maybeSingle()

    const { error } = await supabase.from('success_cases').insert({
      public_need_id: (need as { id: string } | null)?.id ?? null,
      case_id: mission.caseId,
      mission_id: mission.id,
      volunteer_id: input.volunteerId,
      title: mission.title,
      category: (need as { category: string } | null)?.category ?? 'humanitarian',
      zone: mission.location.zone || mission.title,
      help_type: 'humanitarian',
      collaborator_type: 'volunteer',
      impact_summary: mission.description,
      verified_by: input.verifiedBy,
      evidence_urls: input.evidenceUrls,
      total_duration_minutes: input.durationMinutes,
      response_minutes: input.responseMinutes,
      public_code: buildSuccessCode(mission.id),
      verified_at: new Date().toISOString(),
    })
    if (error) throw error
    return true
  } catch (error) {
    console.warn('[SUCCESS_CASE] No se pudo registrar el caso de éxito', error)
    return false
  }
}

function buildSuccessCode(missionId: string): string {
  const year = new Date().getFullYear()
  return `FARO-${year}-${missionId.slice(0, 6).toUpperCase()}`
}
