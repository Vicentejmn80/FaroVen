import { missionRepository, type MissionFilters } from '@/repositories/mission-repository'
import { transitionMission, canTransitionMission } from '@/domain/mission.service'
import type { Mission, MissionAssignment, MissionEvent, MissionStage, TransitionResult } from '@/domain/mission.types'
import { MISSION_STAGES } from '@/domain/mission.types'

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
    return missionRepository.updateAssignment(assignmentId, {
      status: 'accepted',
      respondedAt: new Date(),
    })
  },

  async rejectAssignment(assignmentId: string, _volunteerId: string): Promise<MissionAssignment> {
    return missionRepository.updateAssignment(assignmentId, {
      status: 'rejected',
      respondedAt: new Date(),
    })
  },

  async markEnRoute(assignmentId: string): Promise<MissionAssignment> {
    return missionRepository.updateAssignment(assignmentId, {
      status: 'en_route',
    })
  },

  async markOnSite(assignmentId: string): Promise<MissionAssignment> {
    return missionRepository.updateAssignment(assignmentId, {
      status: 'on_site',
      arrivedAt: new Date(),
    })
  },

  async markCompleted(assignmentId: string): Promise<MissionAssignment> {
    return missionRepository.updateAssignment(assignmentId, {
      status: 'completed',
      completedAt: new Date(),
    })
  },
}
