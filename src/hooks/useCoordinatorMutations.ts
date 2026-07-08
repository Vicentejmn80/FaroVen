import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '@/lib/require-supabase'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import {
  adjustNeedStock,
  closeNeedCycle,
  markNeedCovered,
  reviewReport,
  updateNeed,
} from '@/services/repository-service'
import type {
  AdjustNeedStockInput,
  CloseNeedCycleInput,
  ReviewReportInput,
  UpdateNeedInput,
} from '@/repositories/types'
import { useToast } from '@/store/toast-context'
import { FARO_QUERY_KEYS } from './query-keys'

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centers] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.needs] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reports] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.events] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.summary] })
}

export function useCoordinatorMutations() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const updateNeedMutation = useMutation({
    mutationFn: async (input: UpdateNeedInput) => {
      requireSupabase()
      try {
        return await updateNeed(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateAll(queryClient)
      showToast('Necesidad editada correctamente.', 'success')
    },
  })

  const markCoveredMutation = useMutation({
    mutationFn: async (needId: string) => {
      requireSupabase()
      try {
        return await markNeedCovered(needId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateAll(queryClient)
      showToast('Necesidad marcada como cubierta.', 'success')
    },
  })

  const adjustStockMutation = useMutation({
    mutationFn: async (input: AdjustNeedStockInput) => {
      requireSupabase()
      try {
        return await adjustNeedStock(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateAll(queryClient)
      showToast('Donacion registrada.', 'success')
    },
  })

  const closeCycleMutation = useMutation({
    mutationFn: async (input: CloseNeedCycleInput) => {
      requireSupabase()
      try {
        return await closeNeedCycle(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateAll(queryClient)
      showToast('Resultado registrado.', 'success')
    },
  })

  const reviewReportMutation = useMutation({
    mutationFn: async (input: ReviewReportInput) => {
      requireSupabase()
      try {
        return await reviewReport(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: (report) => {
      invalidateAll(queryClient)
      showToast(
        report.status === 'verified' ? 'Reporte aprobado.' : 'Reporte rechazado.',
        report.status === 'verified' ? 'success' : 'warning',
      )
    },
  })

  return {
    updateNeed: updateNeedMutation,
    markCovered: markCoveredMutation,
    adjustStock: adjustStockMutation,
    closeNeedCycle: closeCycleMutation,
    reviewReport: reviewReportMutation,
  }
}
