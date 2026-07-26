import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { caseApplicationService } from '@/services/case-application-service'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'

function isNonRetryableQueryError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; status?: number; message?: string }
  if (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404) return true
  if (err.code === 'PGRST200' || err.code === 'PGRST201' || err.code === 'PGRST202' || err.code === '42703') return true
  const message = (err.message ?? '').toLowerCase()
  return message.includes('does not exist') || message.includes('could not find')
}

export function useCaseApplications(caseId: string | undefined) {
  // Sin caseId no suscribir: evita canal `case-apps-undefined` + invalidaciones a ciegas.
  useRealtimeSync({
    channelName: caseId ? `case-apps-${caseId}` : 'case-apps-idle',
    tables: caseId ? ['case_applications', 'case_events'] : [],
    invalidateKeys: caseId
      ? [FARO_QUERY_KEYS.caseApplications, FARO_QUERY_KEYS.caseEvents, FARO_QUERY_KEYS.cases]
      : [],
  })

  return useQuery({
    queryKey: [FARO_QUERY_KEYS.caseApplications, caseId],
    queryFn: () => caseApplicationService.listByCase(caseId!),
    enabled: !!caseId,
    staleTime: 10_000,
    // Antes: refetchInterval 5s + realtime + invalidación del workspace = tormenta de 400.
    refetchInterval: false,
    retry: (failureCount, error) => {
      if (isNonRetryableQueryError(error)) return false
      return failureCount < 2
    },
  })
}

export function useApplyToCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      caseId,
      applicantId,
      ...params
    }: {
      caseId: string
      applicantId: string
      organization?: string
      message?: string
      skills?: string[]
      availability?: string
    }) => caseApplicationService.apply(caseId, applicantId, params),
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
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
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
