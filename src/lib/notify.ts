import { supabase } from './supabase'

export async function notifyUser(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, unknown>,
) {
  try {
    await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: 'system',
      p_priority: 'normal',
      p_metadata: (data ?? {}) as Record<string, unknown>,
    })
  } catch {
    console.warn('[NOTIFY] Failed to send notification:', title)
  }
}
