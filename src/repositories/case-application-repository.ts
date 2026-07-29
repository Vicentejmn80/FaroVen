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

interface ProfileEmbed {
  id: string
  full_name: string | null
  phone: string | null
}

interface VolunteerMetricsRow {
  user_id: string
  total_missions: number | null
  completed_missions: number | null
  service_hours: number | null
  trust_score: number | null
  avg_response_minutes: number | null
  specialties: string[] | null
  last_activity_at: string | null
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

async function enrichApplications(
  rows: Array<CaseApplicationRow & { profiles: ProfileEmbed | ProfileEmbed[] | null }>,
): Promise<CaseApplicationWithApplicant[]> {
  const applicantIds = [...new Set(rows.map((row) => row.applicant_id).filter(Boolean))]
  const metricsByUserId = new Map<string, VolunteerMetricsRow>()
  if (applicantIds.length > 0) {
    const { data: volunteers, error: volunteersError } = await supabase
      .from('volunteers')
      .select(
        'user_id, total_missions, completed_missions, service_hours, trust_score, avg_response_minutes, specialties, last_activity_at',
      )
      .in('user_id', applicantIds)

    if (volunteersError) throw volunteersError
    for (const volunteer of (volunteers ?? []) as VolunteerMetricsRow[]) {
      metricsByUserId.set(volunteer.user_id, volunteer)
    }
  }

  return rows.map((row) => {
    const app = mapRow(row)
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const metrics = metricsByUserId.get(row.applicant_id)

    return {
      ...app,
      applicantName: profile?.full_name?.trim() || 'Voluntario',
      applicantPhone: profile?.phone ?? undefined,
      applicantPhoto: undefined,
      totalMissions: metrics?.total_missions ?? undefined,
      completedMissions: metrics?.completed_missions ?? undefined,
      serviceHours: metrics?.service_hours ?? undefined,
      trustScore: metrics?.trust_score ?? undefined,
      avgResponseMin: metrics?.avg_response_minutes ?? undefined,
      specialties: metrics?.specialties ?? undefined,
      lastActivity: metrics?.last_activity_at ? new Date(metrics.last_activity_at) : undefined,
    }
  })
}

/**
 * Modelo Operations Hub:
 * - case_applications.applicant_id → profiles.id  (identidad del postulante)
 * - métricas operativas viven en volunteers.user_id (= profiles.id)
 *
 * Nunca embeber columnas de volunteers dentro de profiles: PostgREST responde 400.
 */
export const caseApplicationRepository = {
  async findById(applicationId: string): Promise<CaseApplication | null> {
    const { data, error } = await supabase.from('case_applications').select('*').eq('id', applicationId).maybeSingle()
    if (error) throw error
    return data ? mapRow(data as CaseApplicationRow) : null
  },

  async findByCaseAndApplicant(caseId: string, applicantId: string): Promise<CaseApplication | null> {
    const { data, error } = await supabase
      .from('case_applications')
      .select('*')
      .eq('case_id', caseId)
      .eq('applicant_id', applicantId)
      .maybeSingle()
    if (error) throw error
    return data ? mapRow(data as CaseApplicationRow) : null
  },

  async listByCase(caseId: string): Promise<CaseApplicationWithApplicant[]> {
    // FK real: case_applications_applicant_id_fkey → profiles(id)
    // Solo columnas que existen en profiles (evidencia: information_schema).
    const { data, error } = await supabase
      .from('case_applications')
      .select('*, profiles!case_applications_applicant_id_fkey(id, full_name, phone)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return enrichApplications(
      (data ?? []) as Array<CaseApplicationRow & { profiles: ProfileEmbed | ProfileEmbed[] | null }>,
    )
  },

  /** Cola global de postulaciones pendientes (vista Postulaciones del GC). */
  async listPendingQueue(): Promise<Array<CaseApplicationWithApplicant & { caseTitle?: string }>> {
    const { data, error } = await supabase
      .from('case_applications')
      .select('*, profiles!case_applications_applicant_id_fkey(id, full_name, phone)')
      .in('status', ['pending', 'under_review'])
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) throw error

    const rows = (data ?? []) as Array<CaseApplicationRow & { profiles: ProfileEmbed | ProfileEmbed[] | null }>
    const apps = await enrichApplications(rows)
    const caseIds = [...new Set(apps.map((a) => a.caseId))]
    const titleByCase = new Map<string, string>()
    if (caseIds.length > 0) {
      const { data: cases } = await supabase.from('cases').select('id, title').in('id', caseIds)
      for (const c of (cases ?? []) as Array<{ id: string; title: string }>) {
        titleByCase.set(c.id, c.title)
      }
    }
    return apps.map((a) => ({ ...a, caseTitle: titleByCase.get(a.caseId) }))
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

    if (error) {
      if (error.code === '23505' || (error.message ?? '').includes('duplicate key')) {
        const existing = await this.findByCaseAndApplicant(caseId, applicantId)
        if (existing) return existing
      }
      throw error
    }

    const row = data?.[0]
    if (!row) {
      const existing = await this.findByCaseAndApplicant(caseId, applicantId)
      if (existing) return existing
      throw new Error('No se pudo crear la postulación')
    }

    return mapRow(row as CaseApplicationRow)
  },

  async updateStatus(applicationId: string, status: CaseApplicationStatus): Promise<void> {
    const { error } = await supabase
      .from('case_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', applicationId)

    if (error) throw error
  },
}
