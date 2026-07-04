import { supabaseNotificationProvider } from '@/notification-provider/supabase-notification-provider'
import type { NotificationListOptions } from '@/notification-provider/types'
import type { NotificationPreferencesRow } from '@/domain/notification-models'

const provider = supabaseNotificationProvider

export const notificationService = {
  listForUser: (userId: string, options?: NotificationListOptions) => provider.listForUser(userId, options),
  markRead: (notificationId: string) => provider.markRead(notificationId),
  markAllRead: () => provider.markAllRead(),
  deleteNotification: (notificationId: string) => provider.deleteNotification(notificationId),
  getPreferences: () => provider.getPreferences(),
  upsertPreferences: (input: Partial<NotificationPreferencesRow> & { muted_until?: string | null }) =>
    provider.upsertPreferences(input),
}
