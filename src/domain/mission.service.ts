import {
  MISSION_STAGES,
  MISSION_EVENT_TYPES,
  VALID_MISSION_TRANSITIONS,
  MISSION_TRANSITION_TO_EVENT,
  missionTransitionKey,
  type MissionStage,
  type Mission,
  type MissionEvent,
  type MissionEventType,
  type TransitionResult,
} from './mission.types'

export function isValidMissionTransition(from: MissionStage, to: MissionStage): boolean {
  const allowed = VALID_MISSION_TRANSITIONS[from]
  return allowed.includes(to)
}

export function getValidMissionTargets(stage: MissionStage): readonly MissionStage[] {
  return VALID_MISSION_TRANSITIONS[stage]
}

export function getMissionTransitionEvent(from: MissionStage, to: MissionStage): MissionEventType | null {
  const key = missionTransitionKey(from, to)
  return (MISSION_TRANSITION_TO_EVENT[key] ?? null) as MissionEventType | null
}

export function canTransitionMission(
  mission: Mission,
  toStage: MissionStage,
): { allowed: boolean; reason?: string } {
  if (mission.status === toStage) {
    return { allowed: false, reason: 'La misión ya se encuentra en ese estado' }
  }

  if (!isValidMissionTransition(mission.status, toStage)) {
    const validStages = getValidMissionTargets(mission.status)
    const stageNames = validStages.map((s) => `"${s}"`).join(', ')
    return {
      allowed: false,
      reason: `No se puede transicionar de "${mission.status}" a "${toStage}". Estados válidos: ${stageNames}`,
    }
  }

  return { allowed: true }
}

export function transitionMission(
  mission: Mission,
  toStage: MissionStage,
  actorId?: string,
  actorName?: string,
  comment?: string,
): TransitionResult {
  const check = canTransitionMission(mission, toStage)
  if (!check.allowed) {
    throw new Error(check.reason)
  }

  const eventType = getMissionTransitionEvent(mission.status, toStage) ?? MISSION_EVENT_TYPES.MISSION_CREATED
  const now = new Date()

  const event: MissionEvent = {
    id: crypto.randomUUID(),
    missionId: mission.id,
    eventType,
    actorId,
    actorName,
    description: comment,
    createdAt: now,
  }

  const updatedMission: Mission = {
    ...mission,
    status: toStage,
    assignedPeople: toStage === MISSION_STAGES.ASSIGNED ? mission.assignedPeople : mission.assignedPeople,
    updatedAt: now,
    completedAt: toStage === MISSION_STAGES.COMPLETED ? now : (toStage === MISSION_STAGES.IN_PROGRESS ? undefined : mission.completedAt),
    verifiedAt: toStage === MISSION_STAGES.VERIFIED ? now : (toStage === MISSION_STAGES.IN_PROGRESS ? undefined : mission.verifiedAt),
    cancelledAt: toStage === MISSION_STAGES.CANCELLED ? now : undefined,
    cancellationReason: toStage === MISSION_STAGES.CANCELLED ? comment : undefined,
  }

  return { mission: updatedMission, event }
}

export function isTerminalMissionStage(stage: MissionStage): boolean {
  return stage === MISSION_STAGES.ARCHIVED
}

export function isActiveMissionStage(stage: MissionStage): boolean {
  return !isTerminalMissionStage(stage) &&
    stage !== MISSION_STAGES.COMPLETED &&
    stage !== MISSION_STAGES.VERIFIED
}

export function canAssignVolunteers(mission: Mission): boolean {
  return mission.status === MISSION_STAGES.MATCHING
}

export function hasRequiredPeople(mission: Mission): boolean {
  return mission.assignedPeople >= mission.requiredPeople
}

export function calculateMissionProgress(stage: MissionStage): number {
  const order: MissionStage[] = [
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
  const idx = order.indexOf(stage)
  if (idx < 0) return 100
  return Math.round((idx / (order.length - 1)) * 100)
}
