import type { NotificationRow } from '@/domain/notification-models'

export type NotificationTimeGroup = 'today' | 'yesterday' | 'this_week' | 'older'

export const NOTIFICATION_GROUP_LABELS: Record<NotificationTimeGroup, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  this_week: 'Esta semana',
  older: 'Más antiguas',
}

export const NOTIFICATION_GROUP_ORDER: NotificationTimeGroup[] = ['today', 'yesterday', 'this_week', 'older']

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function getTimeGroup(date: Date, now = new Date()): NotificationTimeGroup {
  const today = startOfDay(now).getTime()
  const created = startOfDay(date).getTime()
  const diffDays = Math.floor((today - created) / 86_400_000)

  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays <= 7) return 'this_week'
  return 'older'
}

export function groupNotificationsByTime(notifications: NotificationRow[]) {
  const groups: Record<NotificationTimeGroup, NotificationRow[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  }

  for (const n of notifications) {
    groups[getTimeGroup(new Date(n.created_at))].push(n)
  }

  return NOTIFICATION_GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => ({
    key,
    label: NOTIFICATION_GROUP_LABELS[key],
    items: groups[key],
  }))
}

export function priorityClass(priority: NotificationRow['priority'], unread: boolean): string {
  if (priority === 'critical') {
    return unread
      ? 'border-critical/40 bg-critical/15 ring-1 ring-critical/25'
      : 'border-critical/20 bg-critical/5'
  }
  if (priority === 'high') {
    return unread ? 'border-warning/30 bg-warning/10' : 'border-white/10 bg-white/[0.04]'
  }
  return unread ? 'border-info/30 bg-info/10' : 'border-white/10 bg-white/[0.04]'
}

export function priorityBadgeClass(priority: NotificationRow['priority']): string {
  switch (priority) {
    case 'critical':
      return 'bg-critical/20 text-critical'
    case 'high':
      return 'bg-warning/20 text-warning'
    case 'low':
      return 'bg-white/10 text-ink-subtle'
    default:
      return 'bg-info/15 text-info'
  }
}

export function priorityLabel(priority: NotificationRow['priority']): string {
  switch (priority) {
    case 'critical':
      return 'Crítica'
    case 'high':
      return 'Alta'
    case 'low':
      return 'Baja'
    default:
      return 'Normal'
  }
}
