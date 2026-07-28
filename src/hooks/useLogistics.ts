import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import {
  recommendCenters,
  listReservationsByCenter,
  listReservationsByCase,
  markReservationReady,
  markReservationDelivered,
} from '@/services/logistics-service'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { useToast } from '@/store/toast-context'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'

/** Centros recomendados para una mision de recursos. */
export function useRecommendedCenters(input: {
  resourceType?: string
  minQty?: number
  missionLat?: number
  missionLng?: number
  enabled?: boolean
}) {
  const enabled =
    (input.enabled ?? true) &&
    Boolean(input.resourceType) &&
    input.missionLat != null &&
    input.missionLng != null
  return useQuery({
    queryKey: [
      FARO_QUERY_KEYS.centerResources,
      'recommended',
      input.resourceType,
      input.minQty,
      input.missionLat,
      input.missionLng,
    ],
    queryFn: () =>
      recommendCenters({
        resourceType: input.resourceType!,
        minQty: input.minQty ?? 1,
        missionLat: input.missionLat!,
        missionLng: input.missionLng!,
      }),
    enabled,
    staleTime: 20_000,
  })
}

/** Reservas activas de un centro (coordinador). */
export function useCenterReservations(centerId: string | undefined) {
  useRealtimeSync({
    channelName: centerId ? `logistics-center-${centerId}` : 'logistics-center-idle',
    tables: centerId ? ['inventory_reservations'] : [],
    invalidateKeys: centerId ? [FARO_QUERY_KEYS.inventoryReservations] : [],
  })
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.inventoryReservations, 'center', centerId],
    queryFn: () => listReservationsByCenter(centerId!),
    enabled: !!centerId,
    staleTime: 8_000,
  })
}

/** Reservas de un caso (GC). */
export function useCaseReservations(caseId: string | undefined) {
  useRealtimeSync({
    channelName: caseId ? `logistics-case-${caseId}` : 'logistics-case-idle',
    tables: caseId ? ['inventory_reservations'] : [],
    invalidateKeys: caseId ? [FARO_QUERY_KEYS.inventoryReservations] : [],
  })
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.inventoryReservations, 'case', caseId],
    queryFn: () => listReservationsByCase(caseId!),
    enabled: !!caseId,
    staleTime: 8_000,
  })
}

export function useMarkReservationReady() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({ reservationId, actorId }: { reservationId: string; actorId?: string }) => {
      try {
        return await markReservationReady(reservationId, actorId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      showToast('Recursos marcados como preparados.', 'success')
    },
    onError: (err: Error) => showToast(err.message, 'warning'),
  })
}

export function useMarkReservationDelivered() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async ({
      reservationId,
      actorId,
      actorName,
    }: {
      reservationId: string
      actorId?: string
      actorName?: string
    }) => {
      try {
        return await markReservationDelivered(reservationId, actorId, actorName)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerResources] })
      showToast('Recursos entregados al voluntario.', 'success')
    },
    onError: (err: Error) => showToast(err.message, 'warning'),
  })
}
