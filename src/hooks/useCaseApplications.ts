import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { caseApplicationService } from '@/services/case-application-service'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'

export function useCaseApplications(caseId: string | undefined) {
  useRealtimeSync({
    channelName: `case-apps-${caseId}`,
    tables: ['case_applications', 'case_events'],
    invalidateKeys: [
      FARO_QUERY_KEYS.caseApplications,
      FARO_QUERY_KEYS.caseEvents,
      FARO_QUERY_KEYS.cases,
    ],
  })

  return useQuery({
    queryKey: [FARO_QUERY_KEYS.caseApplications, caseId],
    queryFn: () => caseApplicationService.listByCase(caseId!),
    enabled: !!caseId,
  })
}

export function useApplyToCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, applicantId, ...params }: { caseId: string; applicantId: string; organization?: string; message?: string; skills?: string[]; availability?: string }) =>
      caseApplicationService.apply(caseId, applicantId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
    },
  })
}

export function useApproveCaseApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationId, operatorId }: { applicationId: string; operatorId: string }) =>
      caseApplicationService.approve(applicationId, operatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseAssignments] })
    },
  })
}

export function useRejectCaseApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationId, operatorId }: { applicationId: string; operatorId: string }) =>
      caseApplicationService.reject(applicationId, operatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
    },
  })
}
