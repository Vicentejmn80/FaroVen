import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_VERIFICATION_LEVELS,
  type VolunteerProfile,
  type VolunteerAvailabilityStatus,
  type VerificationLevel,
  type VolunteerAvailabilityLog,
} from './volunteer.types'

export function canAcceptMission(volunteer: VolunteerProfile): { allowed: boolean; reason?: string } {
  if (volunteer.availability === VOLUNTEER_AVAILABILITY.ON_MISSION) {
    return { allowed: false, reason: 'Ya estás en una misión activa' }
  }
  if (volunteer.availability === VOLUNTEER_AVAILABILITY.UNAVAILABLE) {
    return { allowed: false, reason: 'No estás disponible actualmente' }
  }
  if (volunteer.availability === VOLUNTEER_AVAILABILITY.OFFLINE) {
    return { allowed: false, reason: 'Estás desconectado' }
  }
  return { allowed: true }
}

export function getActiveMissionCount(
  missions: Array<{ volunteerId: string; status: string }>,
  volunteerId: string,
): number {
  return missions.filter(
    (m) =>
      m.volunteerId === volunteerId &&
      !['completed', 'verified', 'archived', 'cancelled'].includes(m.status),
  ).length
}

export function calculateTrustScore(profile: {
  completedMissions: number
  totalMissions: number
  avgResponseMinutes: number
  verificationLevel: VerificationLevel
}): number {
  let score = 0

  if (profile.totalMissions > 0) {
    const completionRate = profile.completedMissions / profile.totalMissions
    score += Math.round(completionRate * 30)
  }

  const verifScores: Record<VerificationLevel, number> = {
    [VOLUNTEER_VERIFICATION_LEVELS.UNVERIFIED]: 0,
    [VOLUNTEER_VERIFICATION_LEVELS.BASIC]: 15,
    [VOLUNTEER_VERIFICATION_LEVELS.ADVANCED]: 30,
    [VOLUNTEER_VERIFICATION_LEVELS.FULL]: 40,
  }
  score += verifScores[profile.verificationLevel] ?? 0

  if (profile.avgResponseMinutes > 0) {
    if (profile.avgResponseMinutes <= 5) score += 20
    else if (profile.avgResponseMinutes <= 15) score += 15
    else if (profile.avgResponseMinutes <= 30) score += 10
    else score += 5
  } else {
    score += 10
  }

  return Math.min(100, Math.max(0, score))
}

export function computeSkillOverlap(required: string[], volunteerSkills: string[]): number {
  if (required.length === 0) return 100
  const matched = required.filter((s) => volunteerSkills.includes(s))
  return Math.round((matched.length / required.length) * 100)
}

export function isVolunteerAvailable(status: VolunteerAvailabilityStatus): boolean {
  return status === VOLUNTEER_AVAILABILITY.AVAILABLE
}

export function computeServiceMetrics(logs: VolunteerAvailabilityLog[]) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentLogs = logs.filter((l) => l.changedAt >= thirtyDaysAgo)

  let availableHours = 0
  let lastChange = thirtyDaysAgo
  let lastStatus: VolunteerAvailabilityStatus | null = null

  for (const log of recentLogs.sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())) {
    if (lastStatus && lastStatus === VOLUNTEER_AVAILABILITY.AVAILABLE) {
      availableHours += (log.changedAt.getTime() - lastChange.getTime()) / (1000 * 60 * 60)
    }
    lastStatus = log.status
    lastChange = log.changedAt
  }

  if (lastStatus === VOLUNTEER_AVAILABILITY.AVAILABLE) {
    availableHours += (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60)
  }

  const totalHours = 24 * 30
  const availabilityPct = Math.round((Math.min(availableHours, totalHours) / totalHours) * 100)

  return { availableHours: Math.round(availableHours * 10) / 10, availabilityPct }
}
