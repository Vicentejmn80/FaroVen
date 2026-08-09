import { useQuery } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { missionService } from '@/services/mission-service'
import type { MissionFilters } from '@/repositories/mission-repository'
import { supabase } from '@/lib/supabase'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'

export function useMissionByCase(caseId: string | null | undefined) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.missions, 'by-case', caseId],
    queryFn: async () => {
      const missions = await missionService.listByCaseId(caseId!)
      return missions[0] ?? null
    },
    enabled: !!caseId,
    staleTime: 5_000,
  })
}

export function useMissions(filters?: MissionFilters) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.missions, filters],
    queryFn: () => missionService.list(filters),
    staleTime: 15_000,
  })
}

export function useMission(id: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.mission, id],
    queryFn: () => missionService.getById(id),
    enabled: !!id,
    staleTime: 10_000,
  })
}

export function useMissionTimeline(missionId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.missionEvents, missionId],
    queryFn: () => missionService.getTimeline(missionId),
    enabled: !!missionId,
    staleTime: 5_000,
  })
}

export function useMissionAssignments(missionId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.missionAssignments, missionId],
    queryFn: () => missionService.getAssignments(missionId),
    enabled: !!missionId,
  })
}

export function useMissionsByCenter(centerId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.missions, 'center', centerId],
    queryFn: () => missionService.listByCenter(centerId),
    enabled: !!centerId,
  })
}

/**
 * Contadores por caso: assignments completed pendientes de verificación GC.
 * El caller debe filtrar casos ya resueltos.
 */
export function usePendingVerificationCounts(enabled = true) {
  useRealtimeSync({
    channelName: enabled ? 'gc-pending-verify' : 'gc-pending-verify-idle',
    tables: enabled ? ['mission_assignments', 'missions', 'cases'] : [],
    invalidateKeys: enabled
      ? [FARO_QUERY_KEYS.missionAssignments, FARO_QUERY_KEYS.missions, FARO_QUERY_KEYS.cases]
      : [],
  })

  return useQuery({
    queryKey: [FARO_QUERY_KEYS.missionAssignments, 'pending-verify-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('mission_assignments')
        .select('id, missions!inner(case_id)')
        .eq('status', 'completed')
        .limit(300)
      if (error) throw error

      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const mission = (row as { missions?: { case_id?: string } | { case_id?: string }[] }).missions
        const caseId = Array.isArray(mission) ? mission[0]?.case_id : mission?.case_id
        if (!caseId) continue
        counts[caseId] = (counts[caseId] ?? 0) + 1
      }
      return counts
    },
    enabled,
    staleTime: 8_000,
  })
}
