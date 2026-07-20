import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { caseRepository } from '@/repositories/case-repository'
import { caseService } from '@/services/case-service'
import { useAuth } from '@/store/auth-context'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'

export function useCoordinatorCases(centerId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.coordinatorCases, centerId],
    queryFn: () => caseRepository.listByCenter(centerId),
    enabled: !!centerId,
  })
}

export function useAcceptCoordinatorCase() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (caseId: string) => {
      if (!user) throw new Error('Usuario no autenticado')
      return caseService.transition(caseId, PIPELINE_STAGES.ACCEPTED, user.id, 'Caso aceptado por el coordinador del centro')
    },
    onSuccess: (_, caseId) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coordinatorCases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents, caseId] })
    },
  })
}

export function useRejectCoordinatorCase() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ caseId, reason }: { caseId: string; reason: string }) => {
      if (!user) throw new Error('Usuario no autenticado')
      return caseService.transition(caseId, PIPELINE_STAGES.PENDING_REVIEW, user.id, `Rechazado por el centro: ${reason}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coordinatorCases] })
    },
  })
}

export function useResolveCoordinatorCase() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (caseId: string) => {
      if (!user) throw new Error('Usuario no autenticado')
      return caseService.transition(caseId, PIPELINE_STAGES.RESOLVED, user.id, 'Caso resuelto por el centro')
    },
    onSuccess: (_, caseId) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coordinatorCases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents, caseId] })
    },
  })
}

export function useStartCoordinatorAttention() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (caseId: string) => {
      if (!user) throw new Error('Usuario no autenticado')
      return caseService.transition(caseId, PIPELINE_STAGES.IN_ATTENTION, user.id, 'Caso en atención por el centro')
    },
    onSuccess: (_, caseId) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coordinatorCases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents, caseId] })
    },
  })
}
