import { supabase } from '@/lib/supabase'
import type { MissionApplication, MissionApplicationWithVolunteer, ApplicationStatus } from '@/domain/mission-application.types'

interface ApplicationRow {
  id: string
  mission_id: string
  volunteer_id: string
  status: string
  distance_km: number | null
  eta_minutes: number | null
  availability: string | null
  notes: string | null
  confidence: number | null
  current_lat: number | null
  current_lng: number | null
  application_source: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: ApplicationRow): MissionApplication {
  return {
    id: row.id,
    missionId: row.mission_id,
    volunteerId: row.volunteer_id,
    status: row.status as ApplicationStatus,
    distanceKm: row.distance_km ?? undefined,
    etaMinutes: row.eta_minutes ?? undefined,
    availability: row.availability ?? undefined,
    notes: row.notes ?? undefined,
    confidence: row.confidence ?? undefined,
    currentLat: row.current_lat ?? undefined,
    currentLng: row.current_lng ?? undefined,
    applicationSource: row.application_source ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export const missionApplicationRepository = {
  async findById(applicationId: string): Promise<MissionApplication | null> {
    const { data, error } = await supabase
      .from('mission_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle()
    if (error) throw error
    return data ? mapRow(data as ApplicationRow) : null
  },

  async listByMission(missionId: string): Promise<MissionApplicationWithVolunteer[]> {
    const { data, error } = await supabase
      .from('mission_applications')
      .select('*, volunteers!inner(id, full_name, phone, total_missions, completed_missions, service_hours, trust_score, avg_response_minutes, specialties, last_activity_at)')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => {
      const app = mapRow(row as unknown as ApplicationRow)
      const v = row.volunteers as Record<string, unknown> | undefined
      return {
        ...app,
        volunteerName: String(v?.full_name ?? ''),
        volunteerPhone: v?.phone ? String(v.phone) : undefined,
        totalMissions: v?.total_missions ? Number(v.total_missions) : undefined,
        completedMissions: v?.completed_missions ? Number(v.completed_missions) : undefined,
        serviceHours: v?.service_hours ? Number(v.service_hours) : undefined,
        trustScore: v?.trust_score ? Number(v.trust_score) : undefined,
        avgResponseMin: v?.avg_response_minutes ? Number(v.avg_response_minutes) : undefined,
        specialties: v?.specialties ? (v.specialties as string[]) : undefined,
        lastActivity: v?.last_activity_at ? new Date(String(v.last_activity_at)) : undefined,
      }
    })
  },

  async applyToMission(missionId: string, volunteerId: string, notes?: string): Promise<{ id: string; distanceKm?: number; etaMinutes?: number }> {
    const { data, error } = await supabase.rpc('apply_to_mission', {
      p_mission_id: missionId,
      p_volunteer_id: volunteerId,
      p_notes: notes ?? null,
      p_lat: null,
      p_lng: null,
    })
    if (error) throw error
    const result = data as Record<string, unknown>
    if (result.error) throw new Error(String(result.error))
    return {
      id: String(result.id),
      distanceKm: result.distance_km as number | undefined,
      etaMinutes: result.eta_minutes as number | undefined,
    }
  },

  async approveApplication(applicationId: string, operatorId: string): Promise<void> {
    const { data, error } = await supabase.rpc('approve_application', {
      p_application_id: applicationId,
      p_operator_id: operatorId,
    })
    if (error) throw error
    const result = data as Record<string, unknown>
    if (result.error) throw new Error(String(result.error))
  },

  async rejectApplication(applicationId: string, operatorId: string): Promise<void> {
    const { data, error } = await supabase.rpc('reject_application', {
      p_application_id: applicationId,
      p_operator_id: operatorId,
    })
    if (error) throw error
    const result = data as Record<string, unknown>
    if (result.error) throw new Error(String(result.error))
  },
}
