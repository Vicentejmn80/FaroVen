import { supabase } from '@/lib/supabase'
import { isMissingTableError } from '@/lib/supabase-errors'
import type {
  CoverageReservation,
  NeedTimeline,
  NeedVerification,
  PublicNeed,
  SuccessCase,
} from '@/domain/public-need.types'

type AnyRow = Record<string, unknown>
type CoverageReservationRow = AnyRow

function toPublicNeed(row: AnyRow): PublicNeed {
  return {
    id: String(row.id),
    reportId: (row.report_id as string | null) ?? null,
    caseId: (row.case_id as string | null) ?? null,
    title: String(row.title ?? 'Necesidad sin título'),
    summary: String(row.summary ?? ''),
    category: String(row.category ?? 'humanitarian'),
    priority: (row.priority as PublicNeed['priority']) ?? 'medium',
    locationPublic: ((row.location_public as Record<string, unknown> | null) ?? {}) as PublicNeed['locationPublic'],
    locationPrivate: (row.location_private as Record<string, unknown> | null) ?? null,
    requiredQuantity: Number(row.required_quantity ?? 0),
    coveredQuantity: Number(row.covered_quantity ?? 0),
    remainingQuantity: Number(row.remaining_quantity ?? 0),
    unit: String(row.unit ?? 'unidad'),
    verificationStatus: (row.verification_status as PublicNeed['verificationStatus']) ?? 'pending_entry',
    visibilityStatus: (row.visibility_status as PublicNeed['visibilityStatus']) ?? 'hidden',
    expiresAt: new Date(String(row.expires_at)),
    status: (row.status as PublicNeed['status']) ?? 'pending',
    verifiedBy: (row.verified_by as string | null) ?? null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  }
}

function toCoverageReservation(row: AnyRow): CoverageReservation {
  return {
    id: String(row.id),
    publicNeedId: String(row.public_need_id),
    collaboratorUserId: (row.collaborator_user_id as string | null) ?? null,
    collaboratorName: (row.collaborator_name as string | null) ?? null,
    collaboratorType: (row.collaborator_type as CoverageReservation['collaboratorType']) ?? 'citizen',
    quantity: Number(row.quantity ?? 0),
    status: (row.status as CoverageReservation['status']) ?? 'reserved',
    expiresAt: new Date(String(row.expires_at)),
    confirmedAt: row.confirmed_at ? new Date(String(row.confirmed_at)) : null,
    cancelledAt: row.cancelled_at ? new Date(String(row.cancelled_at)) : null,
    createdAt: new Date(String(row.created_at)),
  }
}

function toNeedVerification(row: AnyRow): NeedVerification {
  const checklist = Array.isArray(row.checklist)
    ? (row.checklist as string[])
    : []
  return {
    id: String(row.id),
    publicNeedId: String(row.public_need_id),
    verificationType: (row.verification_type as NeedVerification['verificationType']) ?? 'entry',
    checklist,
    decision: (row.decision as NeedVerification['decision']) ?? 'needs_info',
    notes: (row.notes as string | null) ?? null,
    verifiedBy: String(row.verified_by),
    createdAt: new Date(String(row.created_at)),
  }
}

function toNeedTimeline(row: AnyRow): NeedTimeline {
  return {
    id: String(row.id),
    publicNeedId: String(row.public_need_id),
    eventType: String(row.event_type),
    detail: String(row.detail ?? ''),
    actorId: (row.actor_id as string | null) ?? null,
    metadata: ((row.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
    createdAt: new Date(String(row.created_at)),
  }
}

function toSuccessCase(row: AnyRow): SuccessCase {
  return {
    id: String(row.id),
    publicNeedId: String(row.public_need_id),
    caseId: (row.case_id as string | null) ?? null,
    missionId: (row.mission_id as string | null) ?? null,
    publicCode: String(row.public_code),
    zone: String(row.zone ?? ''),
    helpType: String(row.help_type ?? 'humanitarian'),
    collaboratorType: (row.collaborator_type as SuccessCase['collaboratorType']) ?? 'mixed',
    impactSummary: String(row.impact_summary ?? ''),
    evidenceUrls: Array.isArray(row.evidence_urls) ? (row.evidence_urls as string[]) : [],
    verifiedBy: String(row.verified_by),
    verifiedAt: new Date(String(row.verified_at)),
    totalDurationMinutes: row.total_duration_minutes == null ? null : Number(row.total_duration_minutes),
    createdAt: new Date(String(row.created_at)),
  }
}

export class PublicNeedRepository {
  async findById(id: string): Promise<PublicNeed | null> {
    const { data, error } = await supabase
      .from('public_needs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toPublicNeed(data as AnyRow) : null
  }

  async listActivePublic(): Promise<PublicNeed[]> {
    const { data, error } = await supabase
      .from('public_needs')
      .select('*')
      .eq('visibility_status', 'public')
      .in('status', ['active', 'reserved', 'in_progress', 'completed'])
      .order('created_at', { ascending: false })
    if (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
    return ((data ?? []) as AnyRow[]).map(toPublicNeed)
  }

  async listOperational(): Promise<PublicNeed[]> {
    const { data, error } = await supabase
      .from('public_needs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
    return ((data ?? []) as AnyRow[]).map(toPublicNeed)
  }

  async createFromReport(input: {
    reportId: string | null
    caseId?: string | null
    title: string
    summary: string
    category: string
    priority: PublicNeed['priority']
    locationPublic: PublicNeed['locationPublic']
    requiredQuantity: number
    unit: string
    expiresAt?: string | null
  }): Promise<PublicNeed> {
    const { data, error } = await supabase
      .from('public_needs')
      .insert({
        report_id: input.reportId,
        case_id: input.caseId ?? null,
        title: input.title,
        summary: input.summary,
        category: input.category,
        priority: input.priority,
        location_public: input.locationPublic,
        required_quantity: input.requiredQuantity,
        unit: input.unit,
        visibility_status: 'hidden',
        status: 'pending',
        expires_at: input.expiresAt ?? undefined,
      })
      .select('*')
      .single()
    if (error) throw error
    return toPublicNeed(data as AnyRow)
  }

  async createFromCase(input: {
    caseId: string
    title: string
    summary: string
    category: string
    priority: string
    zone: string
    location?: { lat?: number | null; lng?: number | null; address?: string; zone?: string }
    actorId?: string
  }): Promise<PublicNeed> {
    const { data, error } = await supabase
      .from('public_needs')
      .insert({
        case_id: input.caseId,
        title: input.title,
        summary: input.summary,
        category: input.category,
        priority: input.priority,
        required_quantity: 1,
        unit: 'unidad',
        location_public: {
          lat: input.location?.lat ?? null,
          lng: input.location?.lng ?? null,
          address: input.location?.address ?? null,
          zone: input.zone,
        },
        visibility_status: 'public',
        verification_status: 'approved_entry',
        status: 'active',
        verified_by: input.actorId ?? null,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select('*')
      .single()
    if (error) throw error
    return toPublicNeed(data as AnyRow)
  }

  async verifyEntry(input: {
    publicNeedId: string
    checklist: string[]
    decision: 'approved' | 'rejected' | 'needs_info'
    notes?: string
    actorId: string
  }): Promise<PublicNeed> {
    const { error: verificationError } = await supabase
      .from('need_verifications')
      .insert({
        public_need_id: input.publicNeedId,
        verification_type: 'entry',
        checklist: input.checklist,
        decision: input.decision,
        notes: input.notes ?? null,
        verified_by: input.actorId,
      })
    if (verificationError) throw verificationError

    const patch =
      input.decision === 'approved'
        ? {
            verification_status: 'approved_entry',
            visibility_status: 'public',
            status: 'active',
            verified_by: input.actorId,
          }
        : {
            verification_status:
              input.decision === 'rejected' ? 'rejected_entry' : 'pending_entry',
            visibility_status: 'hidden',
            status: input.decision === 'rejected' ? 'archived' : 'pending',
            verified_by: input.actorId,
          }

    const { data, error } = await supabase
      .from('public_needs')
      .update(patch)
      .eq('id', input.publicNeedId)
      .select('*')
      .single()
    if (error) throw error
    return toPublicNeed(data as AnyRow)
  }

  async createCoverageReservation(input: {
    publicNeedId: string
    collaboratorName?: string
    collaboratorType?: CoverageReservation['collaboratorType']
    quantity: number
  }): Promise<CoverageReservation> {
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('coverage_reservations')
      .insert({
        public_need_id: input.publicNeedId,
        collaborator_user_id: userData.user?.id ?? null,
        collaborator_name: input.collaboratorName ?? null,
        collaborator_type: input.collaboratorType ?? 'citizen',
        quantity: input.quantity,
      })
      .select('*')
      .single()
    if (error) throw error
    return toCoverageReservation(data as AnyRow)
  }

  async listCoverageReservationsByNeed(publicNeedId: string): Promise<CoverageReservation[]> {
    const { data, error } = await supabase
      .from('coverage_reservations')
      .select('*')
      .eq('public_need_id', publicNeedId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as CoverageReservationRow[]).map((row) => toCoverageReservation(row))
  }

  async findCoverageReservationById(reservationId: string): Promise<CoverageReservation | null> {
    const { data, error } = await supabase
      .from('coverage_reservations')
      .select('*')
      .eq('id', reservationId)
      .maybeSingle()
    if (error) throw error
    return data ? toCoverageReservation(data as CoverageReservationRow) : null
  }

  async updateReservationStatus(input: {
    reservationId: string
    status: CoverageReservation['status']
  }): Promise<CoverageReservation> {
    const patch: Record<string, unknown> = { status: input.status }
    if (input.status === 'confirmed') patch.confirmed_at = new Date().toISOString()
    if (input.status === 'cancelled') patch.cancelled_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('coverage_reservations')
      .update(patch)
      .eq('id', input.reservationId)
      .select('*')
      .single()
    if (error) throw error
    return toCoverageReservation(data as AnyRow)
  }

  async listNeedTimeline(publicNeedId: string): Promise<NeedTimeline[]> {
    const { data, error } = await supabase
      .from('need_timelines')
      .select('*')
      .eq('public_need_id', publicNeedId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as AnyRow[]).map(toNeedTimeline)
  }

  async listNeedVerifications(publicNeedId: string): Promise<NeedVerification[]> {
    const { data, error } = await supabase
      .from('need_verifications')
      .select('*')
      .eq('public_need_id', publicNeedId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as AnyRow[]).map(toNeedVerification)
  }

  async listSuccessCases(limit = 20): Promise<SuccessCase[]> {
    const { data, error } = await supabase
      .from('success_cases')
      .select('*')
      .order('verified_at', { ascending: false })
      .limit(limit)
    if (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
    return ((data ?? []) as AnyRow[]).map(toSuccessCase)
  }
}

export const publicNeedRepository = new PublicNeedRepository()

