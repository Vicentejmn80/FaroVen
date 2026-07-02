import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/store/auth-context'
import { userNotificationService } from '@/services/user-notification-service'

export const USER_NOTIFICATION_QUERY_KEYS = {
  mine: ['notifications', 'user'] as const,
}

export function useUserNotifications() {
  const { user } = useAuth()
  const enabled = Boolean(user)

  const query = useQuery({
    queryKey: [...USER_NOTIFICATION_QUERY_KEYS.mine, user?.id],
    queryFn: () => userNotificationService.listForUser(user!.id),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  })

  const unreadCount = useMemo(
    () => (query.data ?? []).filter((n) => n.status === 'unread').length,
    [query.data],
  )

  return { ...query, unreadCount, enabled }
}

export function useUserNotificationMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const markRead = useMutation({
    mutationFn: (notificationId: string) => userNotificationService.markRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USER_NOTIFICATION_QUERY_KEYS.mine })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => userNotificationService.markAllRead(user!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USER_NOTIFICATION_QUERY_KEYS.mine })
    },
  })

  return { markRead, markAllRead }
}
