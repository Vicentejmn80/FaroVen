import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NOTIFICATION_QUERY_KEYS } from '@/domain/notification-models'
import type { MuteDuration, NotificationPreferencesRow } from '@/domain/notification-models'
import { notificationService } from '@/notification-service/notification-service'
import { useAuth } from '@/store/auth-context'

export function muteUntilFromDuration(duration: MuteDuration): string | null {
  if (!duration) return null
  const now = new Date()
  const minutes =
    duration === '30m' ? 30 : duration === '1h' ? 60 : duration === '8h' ? 480 : duration === '24h' ? 1440 : 0
  if (!minutes) return null
  now.setMinutes(now.getMinutes() + minutes)
  return now.toISOString()
}

export function useNotificationPreferences() {
  const { user } = useAuth()
  const enabled = Boolean(user)

  return useQuery({
    queryKey: [...NOTIFICATION_QUERY_KEYS.preferences, user?.id],
    queryFn: () => notificationService.getPreferences(),
    enabled,
  })
}

export function useNotificationPreferenceMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.preferences })
  }

  const update = useMutation({
    mutationFn: (input: Partial<NotificationPreferencesRow> & { muted_until?: string | null }) =>
      notificationService.upsertPreferences(input),
    onSuccess: invalidate,
  })

  const setMute = useMutation({
    mutationFn: (duration: MuteDuration) =>
      notificationService.upsertPreferences({ muted_until: muteUntilFromDuration(duration) }),
    onSuccess: invalidate,
  })

  const clearMute = useMutation({
    mutationFn: () => notificationService.upsertPreferences({ muted_until: null }),
    onSuccess: invalidate,
  })

  return { update, setMute, clearMute }
}
