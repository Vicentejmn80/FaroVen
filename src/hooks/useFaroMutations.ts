import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '@/lib/require-supabase'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import {
  adjustNeedStock,
  registerNeed,
  registerSite,
  submitReport,
  updateCenter,
  updateSiteSaturation,
} from '@/services/repository-service'
import type {
  AdjustNeedStockInput,
  RegisterNeedInput,
  RegisterSiteInput,
  SubmitReportInput,
  UpdateCenterInput,
  UpdateSaturationInput,
} from '@/repositories/types'
import { useToast } from '@/store/toast-context'
import { FARO_QUERY_KEYS } from './query-keys'

function invalidateOperationalData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centers] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.needs] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.events] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.summary] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.siteSaturation] })
}

export function useRegisterSite() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: RegisterSiteInput) => {
      requireSupabase()
      try {
        return await registerSite(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateOperationalData(queryClient)
      showToast('Centro registrado correctamente.', 'success')
    },
  })
}

export function useUpdateCenter() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: UpdateCenterInput) => {
      requireSupabase()
      try {
        return await updateCenter(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateOperationalData(queryClient)
      showToast('Centro actualizado correctamente.', 'success')
    },
  })
}

export function useRegisterNeed() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: RegisterNeedInput) => {
      requireSupabase()
      try {
        return await registerNeed(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateOperationalData(queryClient)
      showToast('Necesidad actualizada.', 'success')
    },
  })
}

export function useAdjustNeedStock() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: AdjustNeedStockInput) => {
      requireSupabase()
      try {
        return await adjustNeedStock(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateOperationalData(queryClient)
      showToast('Movimiento de inventario registrado.', 'success')
    },
  })
}

export function useUpdateSaturation() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: UpdateSaturationInput) => {
      requireSupabase()
      try {
        return await updateSiteSaturation(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      invalidateOperationalData(queryClient)
      showToast('Saturacion publicada.', 'success')
    },
  })
}

export function useSubmitReport() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: SubmitReportInput) => {
      requireSupabase()
      try {
        return await submitReport(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reports] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.events] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.summary] })
      showToast('Reporte enviado. Gracias por colaborar.', 'success')
    },
  })
}
