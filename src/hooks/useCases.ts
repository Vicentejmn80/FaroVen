import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { caseService } from '@/services/case-service'
import { FARO_QUERY_KEYS } from './query-keys'
import type { CaseFilters } from '@/repositories/case-repository'

export function useCases(filters?: CaseFilters) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.cases, filters],
    queryFn: () => caseService.list(filters),
    staleTime: 15000,
  })
}

export function useCase(id: string | null) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.cases, id],
    queryFn: () => (id ? caseService.getById(id) : null),
    enabled: !!id,
    staleTime: 10000,
  })
}

export function useCaseTimeline(caseId: string | null) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.caseEvents, caseId],
    queryFn: () => (caseId ? caseService.getTimeline(caseId) : []),
    enabled: !!caseId,
    staleTime: 5000,
  })
}

export function useArchiveCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      caseId,
      actorId,
      comment,
    }: {
      caseId: string
      actorId?: string
      comment?: string
    }) => caseService.archive(caseId, actorId, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
    },
  })
}

export function useOpenCaseForApplications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      caseId,
      actorId,
      comment,
    }: {
      caseId: string
      actorId?: string
      comment?: string
    }) => caseService.transition(caseId, 'open_for_applications', actorId, comment ?? 'Caso abierto a postulaciones'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
    },
  })
}
