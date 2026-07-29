import { useEffect, useId, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'

interface RealtimeSyncOptions {
  channelName?: string
  tables: string[]
  invalidateKeys: string[]
}

/**
 * Cada consumidor recibe un canal único.
 * Reusar el mismo nombre tras `subscribe()` rompe con:
 * "cannot add postgres_changes callbacks after subscribe()".
 */
export function useRealtimeSync({ channelName = 'faro-realtime', tables, invalidateKeys }: RealtimeSyncOptions) {
  const queryClient = useQueryClient()
  const instanceId = useId().replace(/:/g, '')
  const tablesKey = useMemo(() => tables.join(','), [tables])
  const keysKey = useMemo(() => invalidateKeys.join(','), [invalidateKeys])

  useEffect(() => {
    if (!isSupabaseEnabled) return
    if (tables.length === 0 || invalidateKeys.length === 0) return

    const channel = supabase.channel(`${channelName}__${instanceId}`)

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          invalidateKeys.forEach((key) => {
            void queryClient.invalidateQueries({ queryKey: [key] })
          })
        },
      )
    }

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [channelName, instanceId, tablesKey, keysKey, queryClient, tables.length, invalidateKeys.length])
}
