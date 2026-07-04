export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low'

export type NotificationCategory =
  | 'requests'
  | 'reports'
  | 'messages'
  | 'emergencies'
  | 'system'
  | 'verified_news'
  | 'nearby_centers'

export interface NotificationRow {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  priority: NotificationPriority
  icon: string | null
  read: boolean
  action_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  read_at: string | null
  push_sent: boolean
  push_opened: boolean
  expires_at: string | null
}

export interface NotificationPreferencesRow {
  user_id: string
  requests_enabled: boolean
  reports_enabled: boolean
  messages_enabled: boolean
  emergencies_enabled: boolean
  system_enabled: boolean
  verified_news_enabled: boolean
  nearby_centers_enabled: boolean
  push_enabled: boolean
  muted_until: string | null
  updated_at: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  provider: string
  provider_player_id: string
  device_type: string | null
  created_at: string
  updated_at: string
}

export type MuteDuration = '30m' | '1h' | '8h' | '24h' | null

export const NOTIFICATION_QUERY_KEYS = {
  list: ['notifications', 'list'] as const,
  preferences: ['notifications', 'preferences'] as const,
  push: ['notifications', 'push'] as const,
} as const
