import { supabase } from '@/lib/supabase'
import type { NotificationPreferencesRow, NotificationRow } from '@/domain/notification-models'
import type { NotificationProvider } from '@/notification-provider/types'

function mapNotification(row: Record<string, unknown>): NotificationRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    type: String(row.type ?? ''),
    priority: (row.priority as NotificationRow['priority']) ?? 'normal',
    icon: row.icon ? String(row.icon) : null,
    read: Boolean(row.read),
    action_url: row.action_url ? String(row.action_url) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    read_at: row.read_at ? String(row.read_at) : null,
    push_sent: Boolean(row.push_sent),
    push_opened: Boolean(row.push_opened),
    expires_at: row.expires_at ? String(row.expires_at) : null,
  }
}

function mapPreferences(row: Record<string, unknown>): NotificationPreferencesRow {
  return {
    user_id: String(row.user_id),
    requests_enabled: Boolean(row.requests_enabled ?? true),
    reports_enabled: Boolean(row.reports_enabled ?? true),
    messages_enabled: Boolean(row.messages_enabled ?? true),
    emergencies_enabled: Boolean(row.emergencies_enabled ?? true),
    system_enabled: Boolean(row.system_enabled ?? true),
    verified_news_enabled: Boolean(row.verified_news_enabled ?? true),
    nearby_centers_enabled: Boolean(row.nearby_centers_enabled ?? true),
    push_enabled: Boolean(row.push_enabled ?? false),
    muted_until: row.muted_until ? String(row.muted_until) : null,
    updated_at: String(row.updated_at),
  }
}

export const supabaseNotificationProvider: NotificationProvider = {
  async listForUser(userId, options) {
    const limit = options?.limit ?? 80
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(mapNotification)
  },

  async markRead(notificationId) {
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId })
    if (error) throw error
  },

  async markAllRead() {
    const { data, error } = await supabase.rpc('mark_all_notifications_read')
    if (error) throw error
    return typeof data === 'number' ? data : 0
  },

  async deleteNotification(notificationId) {
    const { error } = await supabase.rpc('delete_notification', { p_notification_id: notificationId })
    if (error) throw error
  },

  async getPreferences() {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user?.id
    if (!userId) return null
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? mapPreferences(data) : null
  },

  async upsertPreferences(input) {
    const { data, error } = await supabase.rpc('upsert_notification_preferences', {
      p_requests: input.requests_enabled ?? null,
      p_reports: input.reports_enabled ?? null,
      p_messages: input.messages_enabled ?? null,
      p_emergencies: input.emergencies_enabled ?? null,
      p_system: input.system_enabled ?? null,
      p_verified_news: input.verified_news_enabled ?? null,
      p_nearby_centers: input.nearby_centers_enabled ?? null,
      p_push: input.push_enabled ?? null,
      p_muted_until: input.muted_until ?? null,
    })
    if (error) throw error
    return mapPreferences(data as Record<string, unknown>)
  },
}
