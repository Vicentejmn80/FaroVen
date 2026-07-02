import { supabase } from '@/lib/supabase'

export interface UserNotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  status: 'unread' | 'read'
  payload: {
    admin_message?: string
    center_name?: string
    review_notes?: string | null
    site_type?: string
    site_id?: string
    request_id?: string
  }
  related_request_id: string | null
  created_at: string
}

function mapNotification(row: Record<string, unknown>): UserNotificationRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    status: row.status as UserNotificationRow['status'],
    payload: (row.payload as UserNotificationRow['payload']) ?? {},
    related_request_id: row.related_request_id ? String(row.related_request_id) : null,
    created_at: String(row.created_at),
  }
}

export const userNotificationRepository = {
  async listForUser(userId: string): Promise<UserNotificationRow[]> {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) throw error
    return (data ?? []).map(mapNotification)
  },

  async markRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ status: 'read' })
      .eq('id', notificationId)
    if (error) throw error
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ status: 'read' })
      .eq('user_id', userId)
      .eq('status', 'unread')
    if (error) throw error
  },
}
