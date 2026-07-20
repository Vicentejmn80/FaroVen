import { volunteerRepository } from '@/repositories/volunteer-repository'
import { calculateTrustScore } from '@/domain/volunteer.service'
import { VOLUNTEER_AVAILABILITY } from '@/domain/volunteer.types'
import type { VolunteerProfile, VolunteerAvailabilityStatus } from '@/domain/volunteer.types'

export const volunteerService = {
  async getProfile(userId: string): Promise<VolunteerProfile | null> {
    return volunteerRepository.findByUserId(userId)
  },

  async getProfileById(id: string): Promise<VolunteerProfile | null> {
    return volunteerRepository.findById(id)
  },

  async createProfile(input: {
    userId: string
    fullName: string
    phone: string
    zone: string
    lat: number
    lng: number
    organization?: string
    experience?: string
  }): Promise<VolunteerProfile> {
    const existing = await volunteerRepository.findByUserId(input.userId)
    if (existing) throw new Error('Ya tienes un perfil de voluntario')

    return volunteerRepository.create(input)
  },

  async updateProfile(id: string, input: Partial<VolunteerProfile>): Promise<VolunteerProfile> {
    return volunteerRepository.update(id, input)
  },

  async updateAvailability(id: string, status: VolunteerAvailabilityStatus): Promise<VolunteerProfile> {
    await volunteerRepository.logAvailability(id, status)
    return volunteerRepository.update(id, { availability: status } as Partial<VolunteerProfile>)
  },

  async addSkill(volunteerId: string, skill: string, proficiency = 1): Promise<void> {
    await volunteerRepository.upsertSkill(volunteerId, skill, proficiency)
  },

  async removeSkill(volunteerId: string, skill: string): Promise<void> {
    await volunteerRepository.removeSkill(volunteerId, skill)
  },

  async listAvailable(params?: { zone?: string; skill?: string }): Promise<VolunteerProfile[]> {
    return volunteerRepository.list({
      ...params,
      availability: VOLUNTEER_AVAILABILITY.AVAILABLE,
    })
  },

  async recalculateTrustScore(id: string): Promise<number> {
    const profile = await volunteerRepository.findById(id)
    if (!profile) throw new Error('Perfil de voluntario no encontrado')

    const score = calculateTrustScore({
      completedMissions: profile.completedMissions,
      totalMissions: profile.totalMissions,
      avgResponseMinutes: profile.avgResponseMinutes,
      verificationLevel: profile.verificationLevel,
    })

    await volunteerRepository.update(id, { trustScore: score } as Partial<VolunteerProfile>)
    return score
  },

  async updateLocation(id: string, lat: number, lng: number): Promise<void> {
    await volunteerRepository.update(id, {
      lat,
      lng,
      lastLocationUpdate: new Date(),
    } as Partial<VolunteerProfile>)
  },
}
