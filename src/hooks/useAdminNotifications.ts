import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/store/auth-context'
import { notificationService } from '@/services/notification-service'
import { canAccessAdminPanel } from '@/lib/roles'

export const NOTIFICATION_QUERY_KEYS = {
  admin: ['notifications', 'admin'] as const,
}

export function useAdminNotifications() {
  const { user, role } = useAuth()
  const enabled = Boolean(user) && canAccessAdminPanel(role)

  const query = useQuery({
    queryKey: [...NOTIFICATION_QUERY_KEYS.admin, user?.id],
    queryFn: () => notificationService.listForUser(user!.id),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  })

  const unreadCount = useMemo(
    () => (query.data ?? []).filter((n) => n.status === 'unread').length,
    [query.data],
  )

  return { ...query, unreadCount, enabled }
}

export function useAdminNotificationMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.admin })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(user!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.admin })
    },
  })

  return { markRead, markAllRead }
}
