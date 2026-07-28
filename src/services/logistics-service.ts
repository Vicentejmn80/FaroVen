import { supabase } from '@/lib/supabase'
import { logisticsRepository, type CenterRecommendation } from '@/repositories/logistics-repository'
import { missionRepository } from '@/repositories/mission-repository'
import { centerOpsRepository } from '@/repositories/center-operations-repository'
import { notifyUser } from '@/lib/notify'
import { logisticsLog } from '@/lib/operational-log'
import { getResourceLabel } from '@/lib/resource-catalog'
import type { InventoryReservation } from '@/domain/center-operations.types'
import type { Mission } from '@/domain/mission.types'
import type { RegisterSiteType } from '@/repositories/types'

/** Recomienda centros con stock libre para una mision de recursos. */
export async function recommendCenters(input: {
  resourceType: string
  minQty: number
  missionLat: number
  missionLng: number
  limit?: number
}): Promise<CenterRecommendation[]> {
  const recommendations = await logisticsRepository.recommendCenters(input)
  logisticsLog('centers_recommended', {
    entityId: input.resourceType,
    entityType: 'case',
    payload: {
      resourceType: input.resourceType,
      minQty: input.minQty,
      count: recommendations.length,
      top: recommendations[0]
        ? { centerId: recommendations[0].centerId, distanceKm: recommendations[0].distanceKm }
        : null,
    },
  })
  return recommendations
}

/**
 * Crea la reserva de inventario y actualiza la mision con centro de recogida.
 * Debe llamarse DESPUES de crear la mision (missionId requerido).
 */
export async function prepareMissionWithReservation(input: {
  mission: Mission
  caseId: string
  centerId: string
  resourceType: string
  quantity: number
  volunteerId?: string
  actorId?: string
}): Promise<InventoryReservation> {
  const reservation = await logisticsRepository.createReservation({
    missionId: input.mission.id,
    caseId: input.caseId,
    centerId: input.centerId,
    resourceType: input.resourceType,
    quantity: input.quantity,
    volunteerId: input.volunteerId,
  })

  // Obtener datos del centro para la mision
  const centers = await recommendCenters({
    resourceType: input.resourceType,
    minQty: input.quantity,
    missionLat: input.mission.location.lat,
    missionLng: input.mission.location.lng,
    limit: 10,
  })
  const center = centers.find((c) => c.centerId === input.centerId) ?? centers[0]

  await missionRepository.update(input.mission.id, {
    pickupCenterId: input.centerId,
    pickupAddress: center?.address,
    resourceType: input.resourceType,
    resourceQty: input.quantity,
    deliveryAddress: input.mission.location.address ?? input.mission.location.zone,
    updatedAt: new Date(),
  } as Partial<Mission>)

  logisticsLog('reservation_created', {
    entityId: reservation.id,
    entityType: 'mission',
    missionId: input.mission.id,
    caseId: input.caseId,
    centerId: input.centerId,
    volunteerId: input.volunteerId,
    actorId: input.actorId,
    payload: {
      resourceType: input.resourceType,
      quantity: input.quantity,
    },
  })

  await notifyCenterCoordinatorOfReservation(reservation, input.mission)

  return reservation
}

/** Marcar recursos preparados (coordinador). */
export async function markReservationReady(reservationId: string, actorId?: string): Promise<InventoryReservation> {
  const reservation = await logisticsRepository.updateReservationStatus(reservationId, 'ready')
  logisticsLog('reservation_ready', {
    entityId: reservationId,
    entityType: 'mission',
    missionId: reservation.missionId,
    centerId: reservation.centerId,
    actorId,
    payload: { resourceType: reservation.resourceType, quantity: reservation.quantity },
  })
  return reservation
}

/**
 * Marcar recursos entregados al voluntario (coordinador).
 * Libera la reserva y descuenta el stock real.
 */
export async function markReservationDelivered(reservationId: string, actorId?: string, actorName?: string): Promise<InventoryReservation> {
  const reservation = await logisticsRepository.updateReservationStatus(reservationId, 'delivered')

  // Descontar stock real (delta negativo)
  await centerOpsRepository.createMovement({
    centerId: reservation.centerId,
    resourceType: reservation.resourceType,
    delta: -reservation.quantity,
    balanceAfter: 0, // sera recalculado por quien lea; el movimiento registra el delta
    reason: 'mission',
    sourceLabel: 'Entrega a mision',
    missionId: reservation.missionId,
    actorId,
    actorName,
  })

  // Bajar current_level para que el stock real refleje la salida
  const { data: resource } = await supabase
    .from('center_resources')
    .select('current_level')
    .eq('center_id', reservation.centerId)
    .eq('resource_type', reservation.resourceType)
    .maybeSingle()
  if (resource) {
    await supabase
      .from('center_resources')
      .update({
        current_level: Math.max((resource.current_level as number) - reservation.quantity, 0),
        updated_at: new Date().toISOString(),
      })
      .eq('center_id', reservation.centerId)
      .eq('resource_type', reservation.resourceType)
  }

  logisticsLog('resources_delivered', {
    entityId: reservationId,
    entityType: 'mission',
    missionId: reservation.missionId,
    centerId: reservation.centerId,
    actorId,
    payload: { resourceType: reservation.resourceType, quantity: reservation.quantity },
  })
  return reservation
}

/** Liberar reserva (mision cancelada o expirada). */
export async function releaseReservationByMission(missionId: string, actorId?: string): Promise<void> {
  await logisticsRepository.updateReservationStatusByMission(missionId, 'released')
  logisticsLog('reservation_released', {
    entityId: missionId,
    entityType: 'mission',
    missionId,
    actorId,
  })
}

export async function listReservationsByCenter(centerId: string): Promise<InventoryReservation[]> {
  return logisticsRepository.listByCenter(centerId, ['reserved', 'ready'])
}

export async function listReservationsByCase(caseId: string): Promise<InventoryReservation[]> {
  return logisticsRepository.listByCase(caseId)
}

export async function getReservationByMission(missionId: string): Promise<InventoryReservation | null> {
  return logisticsRepository.findByMissionId(missionId)
}

/** Notifica al coordinador del centro sobre una nueva preparacion. */
async function notifyCenterCoordinatorOfReservation(reservation: InventoryReservation, mission: Mission): Promise<void> {
  try {
    const coordinators = await getCenterCoordinatorUserIds(reservation.centerId)
    if (coordinators.length === 0) return

    const volunteerName = await getVolunteerDisplayName(reservation.volunteerId)
    const resourceLabel = getResourceLabel(reservation.resourceType)
    const missionTitle = mission.title

    for (const userId of coordinators) {
      await notifyUser(
        userId,
        'Nueva preparación de recursos',
        `${volunteerName} recogerá ${reservation.quantity} ${resourceLabel} para la misión "${missionTitle}".`,
        'logistics_preparation',
        {
          reservationId: reservation.id,
          missionId: reservation.missionId,
          resourceType: reservation.resourceType,
          quantity: reservation.quantity,
          volunteerName,
        },
        {
          priority: 'high',
          actionUrl: `tab:ops:preparations:${reservation.id}`,
          icon: 'package',
        },
      )
    }
  } catch {
    console.warn('[FARO_LOGISTICS] No se pudo notificar al coordinador del centro')
  }
}

async function getCenterCoordinatorUserIds(centerId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('coordinator_profiles')
      .select('auth_user_id')
      .eq('site_id', centerId)
      .eq('onboarding_complete', true)
    return ((data ?? []) as { auth_user_id: string }[]).map((r) => r.auth_user_id)
  } catch {
    return []
  }
}

async function getVolunteerDisplayName(volunteerId?: string): Promise<string> {
  if (!volunteerId) return 'Un voluntario'
  try {
    const { data } = await supabase
      .from('volunteers')
      .select('full_name')
      .eq('id', volunteerId)
      .maybeSingle()
    return (data as { full_name: string | null } | null)?.full_name ?? 'Un voluntario'
  } catch {
    return 'Un voluntario'
  }
}

export type { CenterRecommendation }
export type { RegisterSiteType }
