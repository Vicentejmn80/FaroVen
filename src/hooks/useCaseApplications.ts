import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { caseApplicationService } from '@/services/case-application-service'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { useToast } from '@/store/toast-context'

function isNonRetryableQueryError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; status?: number; message?: string }
  if (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404) return true
  if (err.code === 'PGRST200' || err.code === 'PGRST201' || err.code === 'PGRST202' || err.code === '42703') return true
  const message = (err.message ?? '').toLowerCase()
  return message.includes('does not exist') || message.includes('could not find')
}

function invalidateAfterApplicationChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseApplications] })
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseAssignments] })
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerMissions] })
  queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
}

export function usePendingApplicationsQueue() {
  useRealtimeSync({
    channelName: 'gc-apps-queue',
    tables: ['case_applications', 'case_events'],
    invalidateKeys: [FARO_QUERY_KEYS.caseApplications, FARO_QUERY_KEYS.cases],
  })

  return useQuery({
    queryKey: [FARO_QUERY_KEYS.caseApplications, 'pending-queue'],
    queryFn: () => caseApplicationService.listPendingQueue(),
    staleTime: 8_000,
  })
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
    refetchInterval: false,
    retry: (failureCount, error) => {
      if (isNonRetryableQueryError(error)) return false
      return failureCount < 2
    },
  })
}

export function useApplyToCase() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({
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
    }) => {
      try {
        return await caseApplicationService.apply(caseId, applicantId, params)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      showToast('Postulación enviada.', 'success')
    },
    onError: (err: Error) => {
      showToast(err.message || 'No se pudo postular.', 'warning')
    },
  })
}

export function useApproveCaseApplication() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({
      applicationId,
      operatorId,
      pickupCenterId,
    }: {
      applicationId: string
      operatorId: string
      pickupCenterId?: string
    }) => {
      try {
        return await caseApplicationService.approve(applicationId, operatorId, pickupCenterId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: (data) => {
      invalidateAfterApplicationChange(queryClient)
      showToast('Voluntario aceptado — misión asignada.', 'success')
      window.dispatchEvent(
        new CustomEvent('faro:mission-assigned', {
          detail: { missionId: data.missionId, caseId: data.caseId },
        }),
      )
    },
    onError: (err: Error) => {
      showToast(err.message || 'No se pudo aceptar la postulación.', 'warning')
    },
  })
}

export function useRejectCaseApplication() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({ applicationId, operatorId }: { applicationId: string; operatorId: string }) => {
      try {
        return await caseApplicationService.reject(applicationId, operatorId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseApplications] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
      showToast('Postulación rechazada.', 'success')
    },
    onError: (err: Error) => {
      showToast(err.message || 'No se pudo rechazar.', 'warning')
    },
  })
}
