import { supabase } from '@/lib/supabase'
import type {
  AdminCoordinatorRow,
  AdminNotificationRow,
  AdminRegistryRow,
  AdminUpdateProfileInput,
} from '@/lib/admin-types'
import type { ProfileRow } from '@/repositories/auth-types'
import type { RegisterSiteType } from '@/repositories/types'

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

export const adminRepository = {
  async listRegistry(): Promise<AdminRegistryRow[]> {
    const { data, error } = await supabase.rpc('admin_registry_overview')
    if (error) throw error
    return (data ?? []) as AdminRegistryRow[]
  },

  async listCoordinators(): Promise<AdminCoordinatorRow[]> {
    const { data, error } = await supabase.rpc('admin_list_coordinators')
    if (error) throw error
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      profile_id: String(row.profile_id),
      auth_user_id: String(row.auth_user_id),
      full_name: String(row.full_name ?? ''),
      email: String(row.email ?? ''),
      phone: row.phone ? String(row.phone) : null,
      site_type: row.site_type as RegisterSiteType,
      site_id: String(row.site_id),
      site_name: row.site_name ? String(row.site_name) : null,
      user_status: String(row.user_status ?? ''),
      user_role: row.user_role ? String(row.user_role) : null,
      updated_at: String(row.updated_at),
    }))
  },

  async listNotifications(limit = 100): Promise<AdminNotificationRow[]> {
    const { data, error } = await supabase.rpc('admin_list_notifications', { p_limit: limit })
    if (error) throw error
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      type: String(row.type ?? ''),
      title: String(row.title ?? ''),
      body: String(row.message ?? row.body ?? ''),
      read: Boolean(row.read),
      created_at: String(row.created_at),
    }))
  },

  async deleteSite(siteType: RegisterSiteType, siteId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_site', {
      p_site_type: siteType,
      p_site_id: siteId,
    })
    if (error) throw error
  },

  async removeCoordinator(profileId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_remove_coordinator', {
      p_profile_id: profileId,
    })
    if (error) throw error
  },

  async revokeCoordinatorRole(userId: string): Promise<ProfileRow> {
    const { data, error } = await supabase.rpc('revoke_coordinator_role', { p_user_id: userId })
    if (error) throw error
    return mapProfile(data as Record<string, unknown>)
  },

  async updateUserStatus(userId: string, status: ProfileRow['status']): Promise<ProfileRow> {
    const { data, error } = await supabase.rpc('admin_update_user_status', {
      p_user_id: userId,
      p_status: status,
    })
    if (error) throw error
    return mapProfile(data as Record<string, unknown>)
  },

  async updateProfile(input: AdminUpdateProfileInput): Promise<ProfileRow> {
    const { data, error } = await supabase.rpc('admin_update_profile', {
      p_user_id: input.userId,
      p_full_name: input.fullName ?? null,
      p_phone: input.phone ?? null,
      p_organization_name: input.organizationName ?? null,
      p_profession: input.profession ?? null,
      p_specialty: input.specialty ?? null,
      p_municipality: input.municipality ?? null,
      p_region: input.region ?? null,
    })
    if (error) throw error
    return mapProfile(data as Record<string, unknown>)
  },

  async deleteNeed(needId: string): Promise<void> {
    const { error } = await supabase.from('needs').delete().eq('id', needId)
    if (error) throw error
  },

  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId)
    if (error) throw error
  },

  async demoteUser(userId: string): Promise<ProfileRow> {
    const { data, error } = await supabase.rpc('admin_demote_user', { p_user_id: userId })
    if (error) throw error
    return mapProfile(data as Record<string, unknown>)
  },

  async deleteUser(userId: string, confirmSuperAdmin = false): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: userId,
      p_confirm_super_admin: confirmSuperAdmin,
    })
    if (error) throw error
  },

  async deleteReport(reportId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_report', { p_report_id: reportId })
    if (error) throw error
  },

  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_event', { p_event_id: eventId })
    if (error) throw error
  },

  async createNeed(input: {
    needableType: RegisterSiteType
    needableId: string
    itemName: string
    priority: string
    qtyRequired: number
    qtyReceived?: number
  }): Promise<void> {
    const { error } = await supabase.rpc('admin_create_need', {
      p_needable_type: input.needableType,
      p_needable_id: input.needableId,
      p_item_name: input.itemName,
      p_priority: input.priority,
      p_qty_required: input.qtyRequired,
      p_qty_received: input.qtyReceived ?? 0,
    })
    if (error) throw error
  },

  async markNeedCovered(needId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_mark_need_covered', { p_need_id: needId })
    if (error) throw error
  },

  async resetOperationalData(preserveEmail?: string): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.rpc('admin_reset_operational_data', {
      p_preserve_email: preserveEmail ?? 'vicentejmn80@gmail.com',
    })
    if (error) throw error
    return (data as Record<string, unknown>) ?? {}
  },
}
