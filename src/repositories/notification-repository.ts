import { supabase } from '@/lib/supabase'

export interface AdminNotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  status: 'unread' | 'read'
  payload: {
    applicant_name?: string
    applicant_email?: string
    center_name?: string
    request_status?: string
    requested_site_type?: string
    requested_site_id?: string
    feedback_id?: string
    category?: string
    category_label?: string
    message?: string
    sender_email?: string
    submitted_at?: string
  }
  related_request_id: string | null
  created_at: string
}

function mapNotification(row: Record<string, unknown>): AdminNotificationRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    status: row.status as AdminNotificationRow['status'],
    payload: (row.payload as AdminNotificationRow['payload']) ?? {},
    related_request_id: row.related_request_id ? String(row.related_request_id) : null,
    created_at: String(row.created_at),
  }
}

export const notificationRepository = {
  async listForUser(userId: string): Promise<AdminNotificationRow[]> {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) throw error
    return (data ?? []).map(mapNotification)
  },

  async markRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ status: 'read' })
      .eq('id', notificationId)
    if (error) throw error
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ status: 'read' })
      .eq('user_id', userId)
      .eq('status', 'unread')
    if (error) throw error
  },
}
