import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'

interface RealtimeSyncOptions {
  channelName?: string
  tables: string[]
  invalidateKeys: string[]
}

export function useRealtimeSync({ channelName = 'faro-realtime', tables, invalidateKeys }: RealtimeSyncOptions) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isSupabaseEnabled) return

    const channel = supabase.channel(channelName)
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
  }, [channelName, invalidateKeys, queryClient, tables])
}
