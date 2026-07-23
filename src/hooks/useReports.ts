import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Report } from '@/domain/models'
import { requireSupabase } from '@/lib/require-supabase'
import { fetchReports } from '@/services/repository-service'
import { reportRepository } from '@/repositories/report-repository'
import { FARO_QUERY_KEYS } from './query-keys'

export function useReports() {
  return useQuery<Report[]>({
    queryKey: [FARO_QUERY_KEYS.reports],
    queryFn: async () => {
      requireSupabase()
      try {
        return await fetchReports()
      } catch {
        return []
      }
    },
    staleTime: 30_000,
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reportId: string) => reportRepository.delete(reportId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reports] })
    },
  })
}
