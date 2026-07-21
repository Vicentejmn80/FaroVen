import { supabase } from '@/lib/supabase'
import type { CoordinatorRequestRow, SubmitRoleRequestInput } from './auth-types'

function mapRowToRoleRequest(row: CoordinatorRequestRow) {
  return {
    id: row.id,
    authUserId: row.auth_user_id ?? '',
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? undefined,
    organization: row.organization ?? undefined,
    requestedRole: (row.requested_role ?? 'coordinator') as 'coordinator' | 'case_manager',
    requestedSiteType: row.requested_site_type ?? undefined,
    requestedSiteId: row.requested_site_id ?? undefined,
    roleTitle: row.role_title ?? undefined,
    reason: row.reason ?? undefined,
    experience: row.experience ?? undefined,
    availabilityHours: row.availability_hours ?? undefined,
    status: row.status as any,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    assignedSiteType: row.assigned_site_type ?? undefined,
    assignedSiteId: row.assigned_site_id ?? undefined,
    reviewNotes: row.review_notes ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export const roleRequestRepository = {
  async list(): Promise<ReturnType<typeof mapRowToRoleRequest>[]> {
    const { data, error } = await supabase
      .from('coordinator_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as CoordinatorRequestRow[]).map(mapRowToRoleRequest)
  },

  async listByUser(userId: string): Promise<ReturnType<typeof mapRowToRoleRequest>[]> {
    const { data, error } = await supabase
      .from('coordinator_requests')
      .select('*')
      .eq('auth_user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as CoordinatorRequestRow[]).map(mapRowToRoleRequest)
  },

  async create(input: SubmitRoleRequestInput): Promise<ReturnType<typeof mapRowToRoleRequest>> {
    const { data, error } = await supabase
      .from('coordinator_requests')
      .insert({
        auth_user_id: undefined,
        full_name: input.fullName.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() ?? null,
        organization: input.organization?.trim() ?? null,
        requested_role: input.requestedRole,
        requested_site_type: input.requestedSiteType ?? null,
        requested_site_id: input.requestedSiteId ?? null,
        role_title: input.roleTitle?.trim() ?? null,
        reason: input.reason?.trim() ?? null,
        experience: input.experience?.trim() ?? null,
        availability_hours: input.availabilityHours ?? null,
        status: 'pending',
      })
      .select('*')
      .single()
    if (error) throw error
    return mapRowToRoleRequest(data as CoordinatorRequestRow)
  },

  async findById(id: string): Promise<ReturnType<typeof mapRowToRoleRequest> | null> {
    const { data, error } = await supabase
      .from('coordinator_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return mapRowToRoleRequest(data as CoordinatorRequestRow)
  },
}

export type RoleRequestDTO = ReturnType<typeof mapRowToRoleRequest>
