import { supabase } from './supabase'

export async function notifyUser(
  userId: string,
  title: string,
  message: string,
  type: string = 'system',
  data?: Record<string, unknown>,
  options?: {
    priority?: 'critical' | 'high' | 'normal' | 'low'
    actionUrl?: string | null
    icon?: string | null
  },
) {
  try {
    await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_priority: options?.priority ?? 'normal',
      p_icon: options?.icon ?? null,
      p_action_url: options?.actionUrl ?? null,
      p_metadata: (data ?? {}) as Record<string, unknown>,
    })
  } catch {
    console.warn('[NOTIFY] Failed to send notification:', title)
  }
}
