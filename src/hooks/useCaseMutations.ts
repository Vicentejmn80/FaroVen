import { useMutation, useQueryClient } from '@tanstack/react-query'
import { caseService, type CreateCaseParams } from '@/services/case-service'
import { assignmentService } from '@/services/assignment-service'
import { slaService } from '@/services/sla-service'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { notifyUser } from '@/lib/notify'
import { useToast } from '@/store/toast-context'
import { FARO_QUERY_KEYS } from './query-keys'
import type { PipelineStage, CasePriority } from '@/domain/case-lifecycle.types'

function invalidateCaseData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseAssignments] })
}

export function useTransitionCase() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({
      caseId,
      toStage,
      actorId,
      comment,
    }: {
      caseId: string
      toStage: PipelineStage
      actorId?: string
      comment?: string
    }) => {
      try {
        return await caseService.transition(caseId, toStage, actorId, comment)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
      showToast('Estado actualizado.', 'success')
    },
  })
}

export function useAssignCase() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({
      caseId,
      centerId,
      assignedBy,
      assignedTo,
      reason,
    }: {
      caseId: string
      centerId: string
      assignedBy: string
      assignedTo?: string
      reason?: string
    }) => {
      try {
        const assignment = await assignmentService.assign(caseId, centerId, assignedBy, assignedTo, reason)
        await caseService.transition(caseId, 'assigned', assignedBy, `Asignado a centro ${centerId}`)
        void slaService.setDeadline(caseId, 'high')
        return assignment
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: (_data, variables) => {
      invalidateCaseData(queryClient)
      if (variables.assignedTo) {
        notifyUser(variables.assignedTo, 'Nuevo caso asignado', `Se te ha asignado un caso. Consulta el panel de coordinación.`)
      }
      showToast('Caso asignado correctamente.', 'success')
    },
  })
}

export function useCreateCase() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: CreateCaseParams) => {
      try {
        return await caseService.create(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
      showToast('Caso creado.', 'success')
    },
  })
}

export function useAcceptAssignment() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      try {
        return await assignmentService.acceptAssignment(assignmentId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
      showToast('Asignación aceptada.', 'success')
    },
  })
}

export function useResolveCase() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({
      caseId,
      actorId,
      comment,
    }: {
      caseId: string
      actorId?: string
      comment?: string
    }) => {
      try {
        return await caseService.transition(caseId, 'resolved', actorId, comment)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
      showToast('Caso resuelto.', 'success')
    },
  })
}

export function useSetSlaDeadline() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({ caseId, priority }: { caseId: string; priority: CasePriority }) => {
      try {
        await slaService.setDeadline(caseId, priority)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
      showToast('SLA establecido.', 'success')
    },
  })
}
