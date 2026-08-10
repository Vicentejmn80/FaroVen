import { useQuery } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { getCaseCoverage, getCaseCoverageMap } from '@/services/case-coverage-service'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'

export function useCaseCoverage(caseId: string | null | undefined) {
  useRealtimeSync({
    channelName: caseId ? `case-coverage-${caseId}` : 'case-coverage-idle',
    tables: caseId
      ? ['mission_assignments', 'missions', 'public_needs', 'inventory_reservations', 'cases']
      : [],
    invalidateKeys: caseId
      ? [
          FARO_QUERY_KEYS.missionAssignments,
          FARO_QUERY_KEYS.missions,
          FARO_QUERY_KEYS.publicNeeds,
          FARO_QUERY_KEYS.inventoryReservations,
          FARO_QUERY_KEYS.cases,
          FARO_QUERY_KEYS.coverage,
        ]
      : [],
  })

  return useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'case', caseId],
    queryFn: () => getCaseCoverage(caseId!),
    enabled: Boolean(caseId),
    staleTime: 5_000,
  })
}

/** Mapa de cobertura para el tablero Kanban (todos los casos visibles). */
export function useCasesCoverageMap(caseIds: string[]) {
  const key = caseIds.slice().sort().join(',')
  useRealtimeSync({
    channelName: caseIds.length ? 'board-coverage' : 'board-coverage-idle',
    tables: caseIds.length
      ? ['mission_assignments', 'missions', 'public_needs', 'inventory_reservations']
      : [],
    invalidateKeys: caseIds.length
      ? [
          FARO_QUERY_KEYS.missionAssignments,
          FARO_QUERY_KEYS.missions,
          FARO_QUERY_KEYS.publicNeeds,
          FARO_QUERY_KEYS.coverage,
        ]
      : [],
  })

  return useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'board', key],
    queryFn: () => getCaseCoverageMap(caseIds),
    enabled: caseIds.length > 0,
    staleTime: 8_000,
  })
}
