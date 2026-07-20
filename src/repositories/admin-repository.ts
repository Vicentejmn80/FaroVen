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
    network_role_selected_at: row.network_role_selected_at ? String(row.network_role_selected_at) : null,
    pending_role: (row.pending_role as ProfileRow['pending_role']) ?? null,
    role_request_reason: row.role_request_reason ? String(row.role_request_reason) : null,
    role_request_status: (row.role_request_status as ProfileRow['role_request_status']) ?? null,
    role_request_reviewed_at: row.role_request_reviewed_at ? String(row.role_request_reviewed_at) : null,
    participation_intent: (row.participation_intent as ProfileRow['participation_intent']) ?? null,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export const adminRepository = {
  async getOperationalSettings(): Promise<{ needCycleDurationHours: number }> {
    const { data, error } = await supabase.from('operational_settings').select('key, value_int')
    if (error) throw error
    const rows = (data ?? []) as Array<{ key: string; value_int: number }>
    const duration = rows.find((row) => row.key === 'need_cycle_duration_hours')?.value_int ?? 24
    return { needCycleDurationHours: duration }
  },

  async updateOperationalSetting(key: string, value: number): Promise<void> {
    const { error } = await supabase.from('operational_settings').upsert({
      key,
      value_int: value,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  },

  async runMaintenanceAction(
    action:
      | 'archive_covered_needs'
      | 'clean_dismissed_reports'
      | 'delete_test_data'
      | 'reset_dashboard'
      | 'clean_old_events'
      | 'delete_closed_needs'
      | 'clean_old_notifications',
  ): Promise<{ action: string; affected: number }> {
    const removeByIds = async (table: 'needs' | 'reports' | 'events' | 'notifications', ids: string[]) => {
      if (ids.length === 0) return 0
      const { error } = await supabase.from(table).delete().in('id', ids)
      if (error) throw error
      return ids.length
    }

    if (action === 'archive_covered_needs') {
      const { data, error } = await supabase
        .from('needs')
        .select('id, qty_required, qty_received, status')
      if (error) throw error
      const ids = (
        (data ?? []) as Array<{
          id: string
          qty_required: number
          qty_received: number
          status: string | null
        }>
      )
        .filter(
          (row) =>
            row.qty_required > 0 &&
            row.qty_received >= row.qty_required &&
            row.status !== 'resolved',
        )
        .map((row) => row.id)
      if (!ids.length) return { action, affected: 0 }
      const { error: updateError } = await supabase
        .from('needs')
        .update({ status: 'resolved', closed_at: new Date().toISOString() })
        .in('id', ids)
      if (updateError) throw updateError
      return { action, affected: ids.length }
    }

    if (action === 'clean_dismissed_reports') {
      const { data, error } = await supabase.from('reports').select('id').eq('status', 'dismissed')
      if (error) throw error
      const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
      return { action, affected: await removeByIds('reports', ids) }
    }

    if (action === 'delete_closed_needs') {
      const { data, error } = await supabase.from('needs').select('id, status, qty_required, qty_received')
      if (error) throw error
      const ids = (
        (data ?? []) as Array<{ id: string; status: string | null; qty_required: number; qty_received: number }>
      )
        .filter(
          (row) =>
            row.status === 'resolved' || row.qty_required <= 0 || row.qty_received >= row.qty_required,
        )
        .map((row) => row.id)
      return { action, affected: await removeByIds('needs', ids) }
    }

    if (action === 'clean_old_events') {
      const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString()
      const { data, error } = await supabase.from('events').select('id').lt('created_at', cutoff)
      if (error) throw error
      const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
      return { action, affected: await removeByIds('events', ids) }
    }

    if (action === 'clean_old_notifications') {
      const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString()
      const { data, error } = await supabase
        .from('notifications')
        .select('id, read, created_at')
      if (error) throw error
      const ids = ((data ?? []) as Array<{ id: string; read: boolean; created_at: string }>)
        .filter((row) => row.read || row.created_at < cutoff)
        .map((row) => row.id)
      return { action, affected: await removeByIds('notifications', ids) }
    }

    if (action === 'delete_test_data') {
      const [needRows, reportRows, eventRows, notificationRows] = await Promise.all([
        supabase.from('needs').select('id, item_name'),
        supabase.from('reports').select('id, description'),
        supabase.from('events').select('id, title, detail'),
        supabase.from('notifications').select('id, title, message'),
      ])

      if (needRows.error) throw needRows.error
      if (reportRows.error) throw reportRows.error
      if (eventRows.error) throw eventRows.error
      if (notificationRows.error) throw notificationRows.error

      const looksLikeTest = (value?: string | null) => {
        const text = (value ?? '').toLowerCase()
        return text.includes('test') || text.includes('prueba') || text.includes('demo') || text.includes('faker')
      }

      const needIds = ((needRows.data ?? []) as Array<{ id: string; item_name: string }>)
        .filter((row) => looksLikeTest(row.item_name))
        .map((row) => row.id)
      const reportIds = ((reportRows.data ?? []) as Array<{ id: string; description: string }>)
        .filter((row) => looksLikeTest(row.description))
        .map((row) => row.id)
      const eventIds = ((eventRows.data ?? []) as Array<{ id: string; title: string; detail: string | null }>)
        .filter((row) => looksLikeTest(row.title) || looksLikeTest(row.detail))
        .map((row) => row.id)
      const notificationIds = ((notificationRows.data ?? []) as Array<{ id: string; title: string; message: string }>)
        .filter((row) => looksLikeTest(row.title) || looksLikeTest(row.message))
        .map((row) => row.id)

      const affected =
        (await removeByIds('needs', needIds)) +
        (await removeByIds('reports', reportIds)) +
        (await removeByIds('events', eventIds)) +
        (await removeByIds('notifications', notificationIds))
      return { action, affected }
    }

    // Reinicio ligero del dashboard sin borrar usuarios/sitios.
    const [needsResult, reportsResult, eventsResult, notificationsResult] = await Promise.all([
      adminRepository.runMaintenanceAction('archive_covered_needs'),
      adminRepository.runMaintenanceAction('clean_dismissed_reports'),
      adminRepository.runMaintenanceAction('clean_old_events'),
      adminRepository.runMaintenanceAction('clean_old_notifications'),
    ])
    return {
      action,
      affected: needsResult.affected + reportsResult.affected + eventsResult.affected + notificationsResult.affected,
    }
  },

  async listRegistry(): Promise<AdminRegistryRow[]> {
    const { data, error } = await supabase.rpc('admin_registry_overview')
    // RPC ausente / 404 / sin permiso: no tumbar la consola
    if (error) return []
    return (data ?? []) as AdminRegistryRow[]
  },

  async listCoordinators(): Promise<AdminCoordinatorRow[]> {
    const { data, error } = await supabase.rpc('admin_list_coordinators')
    if (error) return []
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
