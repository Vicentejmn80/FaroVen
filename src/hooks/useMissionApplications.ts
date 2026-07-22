import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { missionApplicationService } from '@/services/mission-application-service'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'

export function useMissionApplications(missionId: string | undefined) {
  useRealtimeSync({
    channelName: `applications-${missionId}`,
    tables: ['mission_applications', 'mission_events'],
    invalidateKeys: [
      FARO_QUERY_KEYS.missionApplications,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.missions,
    ],
  })

  return useQuery({
    queryKey: [FARO_QUERY_KEYS.missionApplications, missionId],
    queryFn: () => missionApplicationService.listByMission(missionId!),
    enabled: !!missionId,
  })
}

export function useApplyToMission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ missionId, volunteerId, notes }: { missionId: string; volunteerId: string; notes?: string }) =>
      missionApplicationService.apply(missionId, volunteerId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.operationalTimeline] })
    },
  })
}

export function useApproveApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationId, operatorId }: { applicationId: string; operatorId: string }) =>
      missionApplicationService.approve(applicationId, operatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.operationalTimeline] })
    },
  })
}

export function useRejectApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationId, operatorId }: { applicationId: string; operatorId: string }) =>
      missionApplicationService.reject(applicationId, operatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.operationalTimeline] })
    },
  })
}
