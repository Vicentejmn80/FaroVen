import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import {
  recommendCenters,
  listReservationsByCenter,
  listReservationsByCase,
  markReservationReady,
  markReservationDelivered,
  advanceCenterMissionStage,
  requestInventoryFromCenter,
  respondToInventoryRequest,
  reserveInventoryByVolunteer,
  acceptVolunteerInventoryReservation,
  sweepExpiredInventoryReservations,
} from '@/services/logistics-service'
import type { CenterResolutionMode } from '@/domain/center-operations.types'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { useToast } from '@/store/toast-context'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'

/** Centros recomendados para una mision de recursos. */
export function useRecommendedCenters(input: {
  resourceType?: string
  resourceLabel?: string
  itemId?: string
  minQty?: number
  missionLat?: number
  missionLng?: number
  enabled?: boolean
}) {
  const enabled =
    (input.enabled ?? true) &&
    Boolean(input.resourceType || input.itemId || input.resourceLabel) &&
    input.missionLat != null &&
    input.missionLng != null
  return useQuery({
    queryKey: [
      FARO_QUERY_KEYS.centerResources,
      'recommended',
      input.resourceType,
      input.resourceLabel,
      input.itemId,
      input.minQty,
      input.missionLat,
      input.missionLng,
    ],
    queryFn: () =>
      recommendCenters({
        resourceType: input.resourceType,
        resourceLabel: input.resourceLabel,
        itemId: input.itemId,
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
    queryFn: async () => {
      await sweepExpiredInventoryReservations().catch(() => 0)
      return listReservationsByCenter(centerId!)
    },
    enabled: !!centerId,
    staleTime: 8_000,
    /** Fallback si Realtime no llega — awareness de solicitudes pendientes. */
    refetchInterval: centerId ? 30_000 : false,
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

/** Coordinador: respuesta operativa (brigada / delivery / necesita voluntario). */
export function useRespondToInventoryRequest() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: {
      reservationId: string
      resolutionMode: CenterResolutionMode
      actorId: string
      notes?: string
      meta?: {
        responsibleName?: string
        etaMinutes?: number
        driverName?: string
        driverPhone?: string
        vehicle?: string
      }
    }) => {
      try {
        return await respondToInventoryRequest(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      if (vars.resolutionMode === 'needs_volunteer') {
        showToast('Inventario confirmado. Se notificó al GC para abrir convocatoria.', 'info')
      } else if (vars.resolutionMode === 'declined') {
        showToast('Solicitud rechazada. El gestor fue notificado.', 'info')
      } else {
        showToast('Aceptado. La misión aparece en tu panel de Misiones.', 'success')
      }
    },
    onError: (err: Error) => showToast(err.message, 'warning'),
  })
}

/** GC: solicitar inventario de un centro → aparece en Solicitudes del Coordinador. */
export function useRequestInventoryFromCenter() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: {
      caseData: CaseDomain
      centerId: string
      resourceType: string
      quantity: number
      actorId: string
    }) => {
      try {
        return await requestInventoryFromCenter(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerResources] })
      showToast('Solicitud enviada al centro — esperando preparación.', 'success')
    },
    onError: (err: Error) => showToast(err.message || 'No se pudo solicitar el inventario.', 'warning'),
  })
}

/** Coordinador: Preparando → En camino (misión interna del centro). */
export function useAdvanceCenterMission() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: {
      reservationId: string
      toStage: 'en_route' | 'delivered'
      actorId?: string
      actorName?: string
      deliveredQuantity?: number
    }) => {
      try {
        return await advanceCenterMissionStage(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      if (vars.toStage === 'en_route') {
        showToast('Misión avanzada a En camino.', 'success')
      } else {
        showToast('Entrega marcada. El gestor puede validar el caso.', 'success')
      }
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
      deliveredQuantity,
    }: {
      reservationId: string
      actorId?: string
      actorName?: string
      deliveredQuantity?: number
    }) => {
      try {
        return await markReservationDelivered(reservationId, actorId, actorName, deliveredQuantity)
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

export function useReserveInventoryByVolunteer() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (input: {
      missionId: string
      caseId: string
      centerId: string
      resourceType: string
      quantity: number
      volunteerId?: string
      volunteerName?: string
      etaMinutes?: number
    }) => {
      try {
        return await reserveInventoryByVolunteer(input)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerResources] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      showToast('Reserva enviada al centro. Esperando confirmación.', 'success')
    },
    onError: (err: Error) => showToast(err.message, 'warning'),
  })
}

export function useAcceptVolunteerInventoryReservation() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: async (reservationId: string) => {
      try {
        return await acceptVolunteerInventoryReservation(reservationId)
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      showToast('Reserva aceptada — voluntario notificado.', 'success')
    },
    onError: (err: Error) => showToast(err.message, 'warning'),
  })
}
