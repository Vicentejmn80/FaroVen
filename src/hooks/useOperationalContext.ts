import { useQuery } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { operationalIntelligenceService } from '@/services/operational-intelligence-service'

export function useOperationalContext() {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.operationalContext],
    queryFn: () => operationalIntelligenceService.buildFullContext(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
