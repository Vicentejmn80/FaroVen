import { useQuery } from '@tanstack/react-query'
import type { Report } from '@/domain/models'
import { requireSupabase } from '@/lib/require-supabase'
import { fetchReports } from '@/services/repository-service'
import { FARO_QUERY_KEYS } from './query-keys'

export function useReports() {
  return useQuery<Report[]>({
    queryKey: [FARO_QUERY_KEYS.reports],
    queryFn: async () => {
      requireSupabase()
      try {
        return await fetchReports()
      } catch {
        // Lectura pública de reportes no habilitada aún; no bloquea la consola.
        return []
      }
    },
    staleTime: 30_000,
  })
}
