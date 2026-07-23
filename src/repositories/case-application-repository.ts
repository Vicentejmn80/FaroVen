import { supabase } from '@/lib/supabase'
import type { CaseApplication, CaseApplicationStatus, CaseApplicationWithApplicant } from '@/domain/case-application.types'

interface CaseApplicationRow {
  id: string
  case_id: string
  applicant_id: string
  organization: string | null
  message: string | null
  skills: string[] | null
  availability: string | null
  distance_km: number | null
  status: string
  created_at: string
  updated_at: string
}

function mapRow(row: CaseApplicationRow): CaseApplication {
  return {
    id: row.id,
    caseId: row.case_id,
    applicantId: row.applicant_id,
    organization: row.organization ?? undefined,
    message: row.message ?? undefined,
    skills: row.skills ?? undefined,
    availability: row.availability ?? undefined,
    distanceKm: row.distance_km ?? undefined,
    status: row.status as CaseApplicationStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export const caseApplicationRepository = {
  async findById(applicationId: string): Promise<CaseApplication | null> {
    const { data, error } = await supabase.from('case_applications').select('*').eq('id', applicationId).maybeSingle()
    if (error) throw error
    return data ? mapRow(data as CaseApplicationRow) : null
  },

  async listByCase(caseId: string): Promise<CaseApplicationWithApplicant[]> {
    const { data, error } = await supabase
      .from('case_applications')
      .select('*, profiles!inner(id, full_name, phone, avatar_url, total_missions, completed_missions, service_hours, trust_score, avg_response_minutes, specialties, last_activity_at)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => {
      const app = mapRow(row as unknown as CaseApplicationRow)
      const p = row.profiles as Record<string, unknown> | undefined
      return {
        ...app,
        applicantName: String(p?.full_name ?? ''),
        applicantPhone: p?.phone ? String(p.phone) : undefined,
        applicantPhoto: p?.avatar_url ? String(p.avatar_url) : undefined,
        totalMissions: p?.total_missions ? Number(p.total_missions) : undefined,
        completedMissions: p?.completed_missions ? Number(p.completed_missions) : undefined,
        serviceHours: p?.service_hours ? Number(p.service_hours) : undefined,
        trustScore: p?.trust_score ? Number(p.trust_score) : undefined,
        avgResponseMin: p?.avg_response_minutes ? Number(p.avg_response_minutes) : undefined,
        specialties: p?.specialties ? (p.specialties as string[]) : undefined,
        lastActivity: p?.last_activity_at ? new Date(String(p.last_activity_at)) : undefined,
      }
    })
  },

  async apply(caseId: string, applicantId: string, params?: {
    organization?: string
    message?: string
    skills?: string[]
    availability?: string
    distanceKm?: number
  }): Promise<CaseApplication> {
    const { data, error } = await supabase
      .from('case_applications')
      .insert({
        case_id: caseId,
        applicant_id: applicantId,
        organization: params?.organization ?? null,
        message: params?.message ?? null,
        skills: params?.skills ?? null,
        availability: params?.availability ?? null,
        distance_km: params?.distanceKm ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    return mapRow(data as CaseApplicationRow)
  },

  async updateStatus(applicationId: string, status: CaseApplicationStatus): Promise<void> {
    const { error } = await supabase
      .from('case_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', applicationId)

    if (error) throw error
  },
}
