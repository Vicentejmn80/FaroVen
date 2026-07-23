import { missionRepository } from '@/repositories/mission-repository'
import { volunteerRepository } from '@/repositories/volunteer-repository'
import { rankVolunteers, selectTopVolunteers, getMinimumScoreForMission } from '@/domain/matching.service'
import { MISSION_STAGES } from '@/domain/mission.types'
import { transitionMission } from '@/domain/mission.service'

export const matchingService = {
  async runMatching(missionId: string): Promise<void> {
    const mission = await missionRepository.findById(missionId)
    if (!mission) throw new Error(`Misión no encontrada: ${missionId}`)

    const minScore = getMinimumScoreForMission(mission)
    const volunteers = await volunteerRepository.list({ zone: mission.location.zone, availability: 'available' })

    if (volunteers.length === 0) {
      await missionRepository.addEvent({
        missionId,
        eventType: 'volunteer_unavailable',
        description: 'No se encontraron voluntarios disponibles en la zona',
      })
      return
    }

    const activeAssignments: Array<{ volunteerId: string; status: string }> = []
    for (const v of volunteers) {
      const assignments = await missionRepository.listAssignmentsByVolunteer(v.id)
      activeAssignments.push(...assignments.map((a) => ({ volunteerId: a.volunteerId, status: a.status })))
    }

    const ranked = rankVolunteers(volunteers, mission, activeAssignments)
    const qualified = ranked.filter((s) => s.totalScore >= minScore)
    const top = selectTopVolunteers(qualified, mission.requiredPeople)

    if (top.length === 0) {
      await missionRepository.addEvent({
        missionId,
        eventType: 'volunteer_unavailable',
        description: 'Ningún voluntario alcanzó el puntaje mínimo para esta misión',
      })
      return
    }

    const result = transitionMission(mission, MISSION_STAGES.ASSIGNED)
    await missionRepository.update(missionId, { ...result.mission, assignedPeople: top.length })

    for (const scored of top) {
      await missionRepository.createAssignment({
        missionId,
        volunteerId: scored.volunteer.id,
      })
    }

    await missionRepository.addEvent({
      missionId,
      eventType: 'matching_completed',
      description: `Matching completado: ${top.length} voluntarios asignados`,
      metadata: { scored: top.map((s) => ({ volunteerId: s.volunteer.id, score: s.totalScore, breakdown: s.breakdown })) },
    })
  },
}
