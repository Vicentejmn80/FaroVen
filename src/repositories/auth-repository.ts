import { supabase } from '@/lib/supabase'
import type {
  ApproveCoordinatorRequestInput,
  AuthAuditRow,
  CoordinatorRequestRow,
  ProfileRow,
  SubmitCoordinatorRequestInput,
} from '@/repositories/auth-types'

function mapProfile(row: Record<string, unknown>): ProfileRow {
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : null,
    role: (row.role as ProfileRow['role']) ?? null,
    organization_id: row.organization_id ? String(row.organization_id) : null,
    organization_name: row.organization_name ? String(row.organization_name) : null,
    profession: row.profession ? String(row.profession) : null,
    specialty: row.specialty ? String(row.specialty) : null,
    municipality: row.municipality ? String(row.municipality) : null,
    region: row.region ? String(row.region) : null,
    status: (row.status as ProfileRow['status']) ?? 'active',
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

/** Evita mostrar solicitudes aprobadas/rechazadas de otro usuario con el mismo email. */
function filterOwnCoordinatorRequests(
  rows: CoordinatorRequestRow[],
  email: string,
  userId: string | null,
): CoordinatorRequestRow[] {
  const normalizedEmail = email.trim().toLowerCase()
  return rows.filter((row) => {
    if (userId && row.auth_user_id === userId) return true
    if (row.auth_user_id && row.auth_user_id !== userId) return false
    if (!row.auth_user_id && row.status === 'pending' && row.email.trim().toLowerCase() === normalizedEmail) {
      return true
    }
    return false
  })
}

function mapRequest(row: Record<string, unknown>): CoordinatorRequestRow {
  return {
    id: String(row.id),
    auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null,
    full_name: String(row.full_name ?? ''),
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : null,
    organization: row.organization ? String(row.organization) : null,
    requested_site_type: (row.requested_site_type as CoordinatorRequestRow['requested_site_type']) ?? null,
    requested_site_id: row.requested_site_id ? String(row.requested_site_id) : null,
    role_title: row.role_title ? String(row.role_title) : null,
    reason: row.reason ? String(row.reason) : null,
    status: row.status as CoordinatorRequestRow['status'],
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    assigned_site_type: (row.assigned_site_type as CoordinatorRequestRow['assigned_site_type']) ?? null,
    assigned_site_id: row.assigned_site_id ? String(row.assigned_site_id) : null,
    review_notes: row.review_notes ? String(row.review_notes) : null,
    info_request_message: row.info_request_message ? String(row.info_request_message) : null,
    info_requested_at: row.info_requested_at ? String(row.info_requested_at) : null,
    info_response: row.info_response ? String(row.info_response) : null,
    info_responded_at: row.info_responded_at ? String(row.info_responded_at) : null,
    needs_info_response: Boolean(row.needs_info_response),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export const profileRepository = {
  async getByUserId(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    return data ? mapProfile(data) : null
  },

  async upsertOwn(userId: string, email: string, fullName: string, phone?: string): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          phone: phone?.trim() || null,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single()
    if (error) throw error
    return mapProfile(data)
  },

  async touchLastLogin(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) throw error
  },

  async listForAdmin(): Promise<ProfileRow[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapProfile)
  },
}

export const coordinatorRequestRepository = {
  async submit(input: SubmitCoordinatorRequestInput, authUserId: string | null): Promise<CoordinatorRequestRow> {
    const { data, error } = await supabase
      .from('coordinator_requests')
      .insert({
        auth_user_id: authUserId,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        organization: input.organization ?? null,
        requested_site_type: input.requestedSiteType,
        requested_site_id: input.requestedSiteId,
        role_title: input.roleTitle ?? null,
        reason: input.reason ?? null,
        status: 'pending',
      })
      .select('*')
      .single()
    if (error) throw error
    return mapRequest(data)
  },

  async listMine(email: string, userId: string | null): Promise<CoordinatorRequestRow[]> {
    let query = supabase.from('coordinator_requests').select('*').order('created_at', { ascending: false })
    if (userId) {
      query = query.or(`auth_user_id.eq.${userId},and(email.eq.${email},auth_user_id.is.null)`)
    } else {
      query = query.eq('email', email).is('auth_user_id', null)
    }
    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []).map(mapRequest)
    return filterOwnCoordinatorRequests(rows, email, userId)
  },

  async listPending(): Promise<CoordinatorRequestRow[]> {
    const { data, error } = await supabase
      .from('coordinator_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapRequest)
  },

  async approve(input: ApproveCoordinatorRequestInput): Promise<CoordinatorRequestRow> {
    const { data, error } = await supabase.rpc('approve_coordinator_request', {
      p_request_id: input.requestId,
      p_assigned_site_type: input.assignedSiteType,
      p_assigned_site_id: input.assignedSiteId,
      p_review_notes: input.reviewNotes ?? null,
    })
    if (error) throw error
    return mapRequest(data as Record<string, unknown>)
  },

  async reject(requestId: string, reviewNotes?: string): Promise<CoordinatorRequestRow> {
    const { data, error } = await supabase.rpc('reject_coordinator_request', {
      p_request_id: requestId,
      p_review_notes: reviewNotes ?? null,
    })
    if (error) throw error
    return mapRequest(data as Record<string, unknown>)
  },

  async requestInfo(requestId: string, message: string): Promise<CoordinatorRequestRow> {
    const { data, error } = await supabase.rpc('request_coordinator_info', {
      p_request_id: requestId,
      p_message: message,
    })
    if (error) throw error
    return mapRequest(data as Record<string, unknown>)
  },

  async respondInfo(requestId: string, response: string): Promise<CoordinatorRequestRow> {
    const { data, error } = await supabase.rpc('respond_coordinator_info', {
      p_request_id: requestId,
      p_response: response,
    })
    if (error) throw error
    return mapRequest(data as Record<string, unknown>)
  },
}

export const authAuditRepository = {
  async listRecent(limit = 50): Promise<AuthAuditRow[]> {
    const { data, error } = await supabase
      .from('auth_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      actor_user_id: row.actor_user_id ? String(row.actor_user_id) : null,
      action: String(row.action),
      target_user_id: row.target_user_id ? String(row.target_user_id) : null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: String(row.created_at),
    }))
  },

  async log(action: string, targetUserId?: string, metadata?: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.rpc('log_auth_event', {
      p_action: action,
      p_target_user_id: targetUserId ?? null,
      p_metadata: metadata ?? {},
    })
    if (error) throw error
  },
}
