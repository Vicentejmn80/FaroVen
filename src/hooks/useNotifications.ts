import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useAuth } from '@/store/auth-context'
import { NOTIFICATION_QUERY_KEYS } from '@/domain/notification-models'
import { notificationService } from '@/notification-service/notification-service'
import { subscribeNotificationChanges } from '@/lib/notification-realtime'

export { NOTIFICATION_QUERY_KEYS }

export function useNotifications() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const enabled = Boolean(user)

  const query = useQuery({
    queryKey: [...NOTIFICATION_QUERY_KEYS.list, user?.id],
    queryFn: () => notificationService.listForUser(user!.id),
    enabled,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (!enabled || !user?.id) return
    return subscribeNotificationChanges(user.id, queryClient)
  }, [enabled, user?.id, queryClient])

  const unreadCount = useMemo(
    () => (query.data ?? []).filter((n) => !n.read).length,
    [query.data],
  )

  return { ...query, unreadCount, enabled }
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.list })
  }

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(notificationId),
    onSuccess: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (notificationId: string) => notificationService.deleteNotification(notificationId),
    onSuccess: invalidate,
  })

  return { markRead, markAllRead, remove }
}
