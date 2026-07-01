import { useQuery } from '@tanstack/react-query'
import type { Need } from '@/domain/models'
import { requireSupabase } from '@/lib/require-supabase'
import { fetchNeeds } from '@/services/repository-service'
import { FARO_QUERY_KEYS } from './query-keys'

export function useNeeds() {
  return useQuery<Need[]>({
    queryKey: [FARO_QUERY_KEYS.needs],
    queryFn: async () => {
      requireSupabase()
      return fetchNeeds()
    },
    staleTime: 30_000,
  })
}
