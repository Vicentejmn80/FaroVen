import { useQuery } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { executiveDashboardService } from '@/services/executive-dashboard-service'

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.executiveDashboard],
    queryFn: () => executiveDashboardService.getDashboardData(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
