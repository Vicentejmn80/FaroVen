import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'
import { NOTIFICATION_QUERY_KEYS } from '@/domain/notification-models'

let activeChannel: RealtimeChannel | null = null
let activeUserId: string | null = null
let subscriberCount = 0

/**
 * Suscripción Realtime singleton para notifications.
 * Evita el error "cannot add postgres_changes callbacks after subscribe()"
 * cuando varios componentes montan useNotifications a la vez.
 */
export function subscribeNotificationChanges(userId: string, queryClient: QueryClient): () => void {
  if (!isSupabaseEnabled) return () => undefined

  subscriberCount += 1

  if (activeChannel && activeUserId !== userId) {
    void supabase.removeChannel(activeChannel)
    activeChannel = null
    activeUserId = null
    subscriberCount = 1
  }

  if (!activeChannel) {
    activeUserId = userId

    const channel = supabase.channel(`notifications-${userId}`)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.list })
      },
    )

    channel.subscribe()

    activeChannel = channel
  }

  return () => {
    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount === 0 && activeChannel) {
      void supabase.removeChannel(activeChannel)
      activeChannel = null
      activeUserId = null
    }
  }
}

/** Solo para tests o logout completo. */
export function teardownNotificationRealtime(): void {
  if (activeChannel) {
    void supabase.removeChannel(activeChannel)
  }
  activeChannel = null
  activeUserId = null
  subscriberCount = 0
}
