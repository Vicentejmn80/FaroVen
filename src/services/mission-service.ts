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
    await missionRepository.addEvent({
      missionId,
      eventType: 'volunteer_assigned',
      actorId,
      description: `Voluntario ${volunteerId} asignado a la misión`,
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
    return updated
  },

  async rejectAssignment(assignmentId: string, _volunteerId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'rejected',
      respondedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'assignment_rejected', 'El voluntario rechazó la asignación')
    return updated
  },

  async markEnRoute(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'en_route',
    })
    await emitAssignmentStatus(updated, 'en_route', 'El voluntario está en camino')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.EN_ROUTE)
    return updated
  },

  async markOnSite(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'on_site',
      arrivedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'on_site', 'El voluntario llegó al sitio')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.ON_SITE)
    return updated
  },

  async markCompleted(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'completed',
      completedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'completed', 'El voluntario finalizó la operación')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.COMPLETED)
    return updated
  },

  async markPreparing(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'preparing',
      preparingAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'preparing', 'El voluntario se está preparando')
    return updated
  },

  async markInProgress(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'in_progress',
    })
    await emitAssignmentStatus(updated, 'in_progress', 'La operación está en progreso')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.IN_PROGRESS)
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
    return updated
  },

  async verifyAssignment(assignmentId: string): Promise<MissionAssignment> {
    const updated = await missionRepository.updateAssignment(assignmentId, {
      status: 'verified',
      verifiedAt: new Date(),
    })
    await emitAssignmentStatus(updated, 'verified', 'Operación verificada por el coordinador')
    await advanceMissionStage(updated.missionId, MISSION_STAGES.VERIFIED)

    // If mission is linked to a case, resolve it and record success
    const mission = await missionRepository.findById(updated.missionId)
    if (mission?.caseId) {
      try {
        await caseService.transition(mission.caseId, 'resolved', updated.volunteerId, 'Misión verificada — caso resuelto')
        await recordSuccessCase({
          caseId: mission.caseId,
          missionId: mission.id,
          zone: mission.location.zone ?? mission.title,
          verifiedBy: updated.volunteerId,
          evidenceUrls: updated.evidenceUrls,
          durationMinutes: mission.completedAt && mission.createdAt
            ? Math.round((mission.completedAt.getTime() - mission.createdAt.getTime()) / 60000)
            : null,
        })
      } catch {
        // Case transition may fail if not allowed, skip silently
      }
    }

    return updated
  },
}

async function recordSuccessCase(input: {
  caseId: string
  missionId: string
  zone: string
  verifiedBy: string
  evidenceUrls: string[]
  durationMinutes: number | null
}) {
  try {
    await supabase.from('success_cases').insert({
      case_id: input.caseId,
      mission_id: input.missionId,
      zone: input.zone,
      verified_by: input.verifiedBy,
      evidence_urls: input.evidenceUrls,
      total_duration_minutes: input.durationMinutes,
      public_code: `CASO-${input.caseId.slice(0, 8)}`,
      verified_at: new Date().toISOString(),
    })
  } catch {
    console.warn('[SUCCESS_CASE] Failed to record success case')
  }
}
