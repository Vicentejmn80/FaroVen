import type { NotificationRow, NotificationPreferencesRow } from '@/domain/notification-models'

export interface NotificationListOptions {
  limit?: number
}

export interface NotificationProvider {
  listForUser(userId: string, options?: NotificationListOptions): Promise<NotificationRow[]>
  markRead(notificationId: string): Promise<void>
  markAllRead(): Promise<number>
  deleteNotification(notificationId: string): Promise<void>
  getPreferences(): Promise<NotificationPreferencesRow | null>
  upsertPreferences(input: Partial<NotificationPreferencesRow> & { muted_until?: string | null }): Promise<NotificationPreferencesRow>
}
