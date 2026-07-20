import { useQuery } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { intelligenceRepository } from '@/repositories/intelligence-repository'

export function useOperationalTimeline(limit = 100) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.operationalTimeline, limit],
    queryFn: () => intelligenceRepository.listTimeline(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
