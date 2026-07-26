import { missionRepository, type MissionFilters } from '@/repositories/mission-repository'
import { transitionMission, canTransitionMission, isTerminalMissionStage } from '@/domain/mission.service'
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

async function advanceMissionStage(missionId: string, toStage: MissionStage, actorId?: string) {
  const mission = await missionRepository.findById(missionId)
  if (!mission || mission.status === toStage || isTerminalMissionStage(mission.status)) return
  try {
    const result = transitionMission(mission, toStage, actorId)
    await missionRepository.update(missionId, result.mission)
    await missionRepository.addEvent({
      missionId,
      eventType: result.event.eventType,
      actorId,
      description: result.event.description ?? `Misión avanzó a ${toStage}`,
    })
  } catch {
    // transition not allowed in current state; skip silently
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
        await caseService.transition(mission.caseId, 'resolved', verifiedBy, 'Misión validada — caso resuelto')
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
