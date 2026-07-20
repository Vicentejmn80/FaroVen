import { useQuery } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { missionService } from '@/services/mission-service'
import type { MissionFilters } from '@/repositories/mission-repository'

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
