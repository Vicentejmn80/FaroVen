import { supabase } from '@/lib/supabase'
import type { VolunteerProfile, VolunteerAvailabilityStatus, VerificationLevel } from '@/domain/volunteer.types'
import type { VolunteerRow } from '@/types/supabase'

function mapVolunteerRow(row: VolunteerRow): VolunteerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    phone: row.phone,
    zone: row.zone,
    lat: row.latitude,
    lng: row.longitude,
    organization: row.organization ?? undefined,
    experience: row.experience ?? undefined,
    availability: row.availability as VolunteerAvailabilityStatus,
    verificationLevel: row.verification_level as VerificationLevel,
    trustScore: row.trust_score,
    avgResponseMinutes: row.avg_response_minutes,
    avgMissionDurationMinutes: row.avg_mission_duration_minutes,
    totalMissions: row.total_missions,
    completedMissions: row.completed_missions,
    serviceHours: row.service_hours,
    skills: [],
    specialties: row.specialties ?? [],
    centersCollaborated: row.centers_collaborated ?? [],
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : undefined,
    lastLocationUpdate: new Date(row.last_location_update),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export class VolunteerRepository {
  async findById(id: string): Promise<VolunteerProfile | null> {
    const { data, error } = await supabase.from('volunteers').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return null
    const profile = mapVolunteerRow(data as VolunteerRow)
    profile.skills = await this.listSkills(id)
    return profile
  }

  async findByUserId(userId: string): Promise<VolunteerProfile | null> {
    const { data, error } = await supabase.from('volunteers').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw error
    if (!data) return null
    const profile = mapVolunteerRow(data as VolunteerRow)
    profile.skills = await this.listSkills(profile.id)
    return profile
  }

  async list(filters?: { zone?: string; availability?: string; skill?: string }): Promise<VolunteerProfile[]> {
    let query = supabase.from('volunteers').select('*')

    if (filters?.zone) query = query.eq('zone', filters.zone)
    if (filters?.availability) query = query.eq('availability', filters.availability)

    const { data, error } = await query.order('trust_score', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as VolunteerRow[]

    const profiles = rows.map(mapVolunteerRow)
    for (const profile of profiles) {
      profile.skills = await this.listSkills(profile.id)
    }

    if (filters?.skill) {
      return profiles.filter((p) => p.skills.includes(filters.skill!))
    }

    return profiles
  }

  async create(input: {
    userId: string
    fullName: string
    phone: string
    zone: string
    lat: number
    lng: number
    organization?: string
    experience?: string
  }): Promise<VolunteerProfile> {
    const { data, error } = await supabase
      .from('volunteers')
      .insert({
        user_id: input.userId,
        full_name: input.fullName,
        phone: input.phone,
        zone: input.zone,
        lat: input.lat,
        lng: input.lng,
        organization: input.organization ?? null,
        experience: input.experience ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapVolunteerRow(data as VolunteerRow)
  }

  async update(id: string, input: Partial<VolunteerProfile>): Promise<VolunteerProfile> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.fullName !== undefined) row.full_name = input.fullName
    if (input.phone !== undefined) row.phone = input.phone
    if (input.zone !== undefined) row.zone = input.zone
    if (input.lat !== undefined) row.lat = input.lat
    if (input.lng !== undefined) row.lng = input.lng
    if (input.organization !== undefined) row.organization = input.organization ?? null
    if (input.experience !== undefined) row.experience = input.experience ?? null
    if (input.availability !== undefined) row.availability = input.availability
    if (input.verificationLevel !== undefined) row.verification_level = input.verificationLevel
    if (input.trustScore !== undefined) row.trust_score = input.trustScore
    if (input.avgResponseMinutes !== undefined) row.avg_response_minutes = input.avgResponseMinutes
    if (input.totalMissions !== undefined) row.total_missions = input.totalMissions
    if (input.completedMissions !== undefined) row.completed_missions = input.completedMissions
    if (input.serviceHours !== undefined) row.service_hours = input.serviceHours
    if (input.lastLocationUpdate !== undefined) row.last_location_update = input.lastLocationUpdate.toISOString()

    const { data, error } = await supabase.from('volunteers').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return mapVolunteerRow(data as VolunteerRow)
  }

  async listSkills(volunteerId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('volunteer_skills')
      .select('skill')
      .eq('volunteer_id', volunteerId)
    if (error) throw error
    return ((data ?? []) as { skill: string }[]).map((r) => r.skill)
  }

  async upsertSkill(volunteerId: string, skill: string, proficiency = 1): Promise<void> {
    const { error } = await supabase.from('volunteer_skills').upsert(
      { volunteer_id: volunteerId, skill, proficiency },
      { onConflict: 'volunteer_id,skill' },
    )
    if (error) throw error
  }

  async removeSkill(volunteerId: string, skill: string): Promise<void> {
    const { error } = await supabase
      .from('volunteer_skills')
      .delete()
      .eq('volunteer_id', volunteerId)
      .eq('skill', skill)
    if (error) throw error
  }

  async logAvailability(volunteerId: string, status: string): Promise<void> {
    const { error } = await supabase.from('volunteer_availability_log').insert({
      volunteer_id: volunteerId,
      status,
    })
    if (error) throw error
  }
}

export const volunteerRepository = new VolunteerRepository()
