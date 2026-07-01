import { useQuery } from '@tanstack/react-query'
import type { Center } from '@/domain/models'
import { requireSupabase } from '@/lib/require-supabase'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { fetchCenter, fetchCenters } from '@/services/repository-service'
import { FARO_QUERY_KEYS } from './query-keys'

async function loadCenters() {
  try {
    return await fetchCenters()
  } catch (err) {
    throw new Error(humanizeSupabaseError(err))
  }
}

export function useCenters() {
  return useQuery<Center[]>({
    queryKey: [FARO_QUERY_KEYS.centers],
    queryFn: async () => {
      requireSupabase()
      return loadCenters()
    },
    staleTime: 30_000,
  })
}

export function useCenter(centerId?: string) {
  return useQuery<Center | null>({
    queryKey: [FARO_QUERY_KEYS.center, centerId],
    enabled: Boolean(centerId),
    queryFn: async () => {
      if (!centerId) return null
      requireSupabase()
      try {
        return await fetchCenter(centerId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    staleTime: 30_000,
  })
}
