import type { Mission } from './mission.types'
import { MISSION_PRIORITIES } from './mission.types'
import type { VolunteerProfile } from './volunteer.types'
import { VOLUNTEER_AVAILABILITY } from './volunteer.types'
import { canAcceptMission, computeSkillOverlap, getActiveMissionCount } from './volunteer.service'

export interface ScoredVolunteer {
  volunteer: VolunteerProfile
  totalScore: number
  breakdown: {
    skills: number
    distance: number
    availability: number
    experience: number
    currentLoad: number
    responseTime: number
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function scoreSkills(mission: Mission, volunteer: VolunteerProfile): number {
  return computeSkillOverlap(mission.requiredSkills, volunteer.skills) * 0.3
}

function scoreDistance(mission: Mission, _volunteer: VolunteerProfile, distanceKm: number): number {
  if (distanceKm > 20) return 0
  const maxUrgentKm = mission.priority === MISSION_PRIORITIES.CRITICAL ? 5 : 10
  if (distanceKm > maxUrgentKm) return Math.max(0, 25 - (distanceKm - maxUrgentKm) * 3)
  return 25
}

function scoreAvailability(volunteer: VolunteerProfile): number {
  if (volunteer.availability === VOLUNTEER_AVAILABILITY.AVAILABLE) return 15
  if (volunteer.availability === VOLUNTEER_AVAILABILITY.BUSY) return 5
  return 0
}

function scoreExperience(volunteer: VolunteerProfile): number {
  if (volunteer.totalMissions === 0) return 0
  if (volunteer.totalMissions > 20) return 15
  if (volunteer.totalMissions > 10) return 12
  if (volunteer.totalMissions > 5) return 8
  return 4
}

function scoreCurrentLoad(
  volunteer: VolunteerProfile,
  activeAssignments: Array<{ volunteerId: string; status: string }>,
): number {
  const count = getActiveMissionCount(activeAssignments, volunteer.id)
  if (count === 0) return 10
  if (count === 1) return 7
  if (count === 2) return 3
  return 0
}

function scoreResponseTime(volunteer: VolunteerProfile): number {
  if (volunteer.avgResponseMinutes === 0) return 3
  if (volunteer.avgResponseMinutes <= 5) return 5
  if (volunteer.avgResponseMinutes <= 15) return 4
  if (volunteer.avgResponseMinutes <= 30) return 2
  return 0
}

export function scoreVolunteer(
  volunteer: VolunteerProfile,
  mission: Mission,
  distanceKm: number,
  activeAssignments: Array<{ volunteerId: string; status: string }>,
): ScoredVolunteer {
  const skills = scoreSkills(mission, volunteer)
  const distance = scoreDistance(mission, volunteer, distanceKm)
  const availability = scoreAvailability(volunteer)
  const experience = scoreExperience(volunteer)
  const currentLoad = scoreCurrentLoad(volunteer, activeAssignments)
  const responseTime = scoreResponseTime(volunteer)

  const totalScore = Math.min(100, Math.round(skills + distance + availability + experience + currentLoad + responseTime))

  return {
    volunteer,
    totalScore,
    breakdown: { skills, distance, availability, experience, currentLoad, responseTime },
  }
}

export function rankVolunteers(
  volunteers: VolunteerProfile[],
  mission: Mission,
  activeAssignments: Array<{ volunteerId: string; status: string }>,
): ScoredVolunteer[] {
  const missionLat = mission.location.lat
  const missionLng = mission.location.lng

  const eligible = volunteers.filter((v) => {
    const check = canAcceptMission(v)
    return check.allowed
  })

  const scored = eligible
    .map((v) => {
      const distanceKm = haversineDistance(missionLat, missionLng, v.lat, v.lng)
      return scoreVolunteer(v, mission, distanceKm, activeAssignments)
    })
    .sort((a, b) => b.totalScore - a.totalScore)

  return scored
}

export function selectTopVolunteers(
  ranked: ScoredVolunteer[],
  count: number,
): ScoredVolunteer[] {
  return ranked.slice(0, count)
}

export function getMinimumScoreForMission(mission: Mission): number {
  if (mission.priority === MISSION_PRIORITIES.CRITICAL) return 50
  if (mission.priority === MISSION_PRIORITIES.HIGH) return 40
  return 30
}
