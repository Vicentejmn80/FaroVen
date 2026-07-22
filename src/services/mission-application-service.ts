import { missionApplicationRepository } from '@/repositories/mission-application-repository'
import { operationalIntelligenceService } from '@/services/operational-intelligence-service'
import type { MissionApplicationWithVolunteer } from '@/domain/mission-application.types'

export const missionApplicationService = {
  async listByMission(missionId: string): Promise<MissionApplicationWithVolunteer[]> {
    return missionApplicationRepository.listByMission(missionId)
  },

  async apply(missionId: string, volunteerId: string, notes?: string) {
    const result = await missionApplicationRepository.applyToMission(missionId, volunteerId, notes)
    await operationalIntelligenceService.emitVolunteerDispatchEvent({
      action: 'application_submitted',
      missionId,
      volunteerId,
      applicationId: result.id,
      distanceKm: result.distanceKm ?? null,
      detail: 'Un voluntario se postuló para ayudar en esta misión',
    })
    return result
  },

  async approve(applicationId: string, operatorId: string) {
    const existing = await missionApplicationRepository.findById(applicationId)
    await missionApplicationRepository.approveApplication(applicationId, operatorId)
    if (existing) {
      await operationalIntelligenceService.emitVolunteerDispatchEvent({
        action: 'application_approved',
        missionId: existing.missionId,
        volunteerId: existing.volunteerId,
        applicationId: existing.id,
        distanceKm: existing.distanceKm ?? null,
        actorId: operatorId,
        detail: 'El gestor aprobó la postulación y se creó la asignación',
      })
    }
  },

  async reject(applicationId: string, operatorId: string) {
    const existing = await missionApplicationRepository.findById(applicationId)
    await missionApplicationRepository.rejectApplication(applicationId, operatorId)
    if (existing) {
      await operationalIntelligenceService.emitVolunteerDispatchEvent({
        action: 'application_rejected',
        missionId: existing.missionId,
        volunteerId: existing.volunteerId,
        applicationId: existing.id,
        distanceKm: existing.distanceKm ?? null,
        actorId: operatorId,
        detail: 'El gestor rechazó la postulación',
      })
    }
  },
}
