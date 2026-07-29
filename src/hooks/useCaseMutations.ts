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

function invalidateClosedCaseCaches(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerMissions] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.successCases] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coverage] })
}

export function useStartCaseReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ caseId, actorId }: { caseId: string; actorId?: string }) => {
      try {
        return await caseService.startReview(caseId, actorId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
    },
  })
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
    onSuccess: (_data, variables) => {
      invalidateCaseData(queryClient)
      if (variables.toStage === 'resolved' || variables.toStage === 'archived') {
        invalidateClosedCaseCaches(queryClient)
      }
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
        // assign() deja el caso en awaiting_center_confirmation — NO en assigned
        return await assignmentService.assign(caseId, centerId, assignedBy, assignedTo, reason)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: (_data, variables) => {
      invalidateCaseData(queryClient)
      if (variables.assignedTo) {
        notifyUser(variables.assignedTo, 'Nuevo caso asignado', `Se te ha asignado un caso. Consulta el panel de coordinación.`)
      }
      showToast('Centro propuesto — esperando confirmación.', 'success')
    },
  })
}

export function useConfirmCenterAssignment() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({ caseId, actorId }: { caseId: string; actorId?: string }) => {
      try {
        return await assignmentService.confirmCenter(caseId, actorId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
      showToast('Centro confirmado — caso asignado.', 'success')
    },
  })
}

export function useRejectCenterAssignment() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({
      caseId,
      actorId,
      reason,
    }: {
      caseId: string
      actorId?: string
      reason?: string
    }) => {
      try {
        return await assignmentService.rejectCenter(caseId, actorId, reason)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateCaseData(queryClient)
      showToast('Sin confirmación del centro — caso vuelve a revisión.', 'info')
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
      showToast('Solicitud recibida en Nuevo.', 'success')
    },
  })
}

export function useConfirmTransferDecision() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: {
      caseId: string
      actorId: string
      executor: 'volunteer' | 'institution' | 'node'
      originCenterId: string
      resourceType: string
    }) => {
      try {
        const { caseManagerService } = await import('@/services/case-manager-service')
        return await caseManagerService.confirmTransferDecision(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: (data) => {
      invalidateCaseData(queryClient)
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
      if (data.next === 'radar') {
        showToast('Transferencia por voluntario: radar abierto.', 'success')
      } else if (data.next === 'awaiting_node') {
        showToast('Transferencia al nodo: esperando confirmación.', 'success')
      } else {
        showToast('Transferencia: elige la institución destino.', 'info')
      }
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
      invalidateClosedCaseCaches(queryClient)
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
