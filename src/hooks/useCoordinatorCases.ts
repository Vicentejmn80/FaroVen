import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { caseRepository } from '@/repositories/case-repository'
import { caseService } from '@/services/case-service'
import { assignmentService } from '@/services/assignment-service'
import { OPS_ACTION_URLS, opsNotify } from '@/services/ops-notification-contract'
import { operationalLog } from '@/lib/operational-log'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth-context'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { useToast } from '@/store/toast-context'

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

/** Centro confirma asignación (brigada/delivery) desde awaiting_center_confirmation → assigned. */
export function useConfirmCenterCase() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({ caseId, notes }: { caseId: string; notes?: string }) => {
      if (!user) throw new Error('Usuario no autenticado')
      const result = await assignmentService.confirmCenter(caseId, user.id)
      operationalLog({
        entityType: 'case',
        entityId: caseId,
        action: 'center_confirmed_assignment',
        actorId: user.id,
        actorRole: 'coordinator',
        to: 'assigned',
        source: 'ui',
        payload: { notes: notes ?? null },
      })
      const caseData = await caseService.getById(caseId)
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['case_manager', 'regional_admin', 'super_admin'])
        .eq('status', 'active')
      await Promise.all(
        (managers ?? []).map((m) =>
          opsNotify({
            to: String(m.id),
            type: 'center_accepted_request',
            title: 'Centro aceptó solicitud',
            message: `El centro aceptó "${caseData?.title ?? caseId.slice(0, 8)}"${notes ? `: ${notes}` : '.'}`,
            priority: 'normal',
            actionUrl: OPS_ACTION_URLS.gcCase(caseId),
            icon: 'check',
            metadata: { caseId, notes: notes ?? null },
            entityType: 'case',
            entityId: caseId,
            caseId,
            actorId: user.id,
          }),
        ),
      )
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coordinatorCases] })
      showToast('Caso confirmado por el centro.', 'success')
    },
  })
}

/** Centro indica que necesita voluntario → notifica GC y devuelve a revisión para abrir radar. */
export function useRequestVolunteerFromCenter() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({ caseId, notes }: { caseId: string; notes?: string }) => {
      if (!user) throw new Error('Usuario no autenticado')
      const reason =
        notes?.trim() ||
        'El centro no posee brigada propia. Se requiere abrir Radar.'
      const result = await assignmentService.rejectCenter(caseId, user.id, reason)
      operationalLog({
        entityType: 'case',
        entityId: caseId,
        action: 'center_needs_volunteer',
        actorId: user.id,
        actorRole: 'coordinator',
        to: 'pending_review',
        source: 'ui',
        payload: { notes: reason },
      })
      const caseData = await caseService.getById(caseId)
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['case_manager', 'regional_admin', 'super_admin'])
        .eq('status', 'active')
      await Promise.all(
        (managers ?? []).map((m) =>
          opsNotify({
            to: String(m.id),
            type: 'center_needs_volunteer',
            title: 'El centro necesita voluntario',
            message: `El centro no posee brigada propia para "${caseData?.title ?? caseId.slice(0, 8)}". Se requiere abrir Radar.`,
            priority: 'high',
            actionUrl: OPS_ACTION_URLS.gcCase(caseId),
            icon: 'users',
            metadata: { caseId, notes: reason },
            entityType: 'case',
            entityId: caseId,
            caseId,
            actorId: user.id,
          }),
        ),
      )
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coordinatorCases] })
      showToast('GC notificado: se requiere abrir Radar.', 'info')
    },
  })
}
