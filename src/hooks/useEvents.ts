import { useQuery } from '@tanstack/react-query'
import type { Event } from '@/domain/models'
import { requireSupabase } from '@/lib/require-supabase'
import { fetchEvents } from '@/services/repository-service'
import { FARO_QUERY_KEYS } from './query-keys'

export function useEvents() {
  return useQuery<Event[]>({
    queryKey: [FARO_QUERY_KEYS.events],
    queryFn: async () => {
      requireSupabase()
      try {
        return await fetchEvents()
      } catch {
        // Tabla events opcional hasta aplicar migración phase5; timeline se deriva de centros/necesidades.
        return []
      }
    },
    staleTime: 15_000,
  })
}
