import { supabase } from '@/lib/supabase'
import { logisticsRepository, type CenterRecommendation } from '@/repositories/logistics-repository'
import { missionRepository } from '@/repositories/mission-repository'
import { centerOpsRepository } from '@/repositories/center-operations-repository'
import { logisticsLog, opsChannelLog } from '@/lib/operational-log'
import { OPS_ACTION_URLS, opsNotify } from '@/services/ops-notification-contract'
import { INVENTORY_RESERVATION_TTL_MINUTES } from '@/domain/ops-pipeline-contract'
import { volunteerRepository } from '@/repositories/volunteer-repository'
import { getResourceLabel } from '@/lib/resource-catalog'
import type { InventoryReservation } from '@/domain/center-operations.types'
import type { Mission } from '@/domain/mission.types'
import type { RegisterSiteType } from '@/repositories/types'

/** Recomienda centros con stock libre para una mision de recursos. */
export async function recommendCenters(input: {
  resourceType?: string
  resourceLabel?: string
  itemId?: string
  minQty: number
  missionLat: number
  missionLng: number
  limit?: number
}): Promise<CenterRecommendation[]> {
  const recommendations = await logisticsRepository.recommendCenters(input)
  logisticsLog('centers_recommended', {
    entityId: input.itemId ?? input.resourceType ?? 'unknown',
    entityType: 'case',
    payload: {
      resourceType: input.resourceType ?? null,
      itemId: input.itemId ?? null,
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
 * GC → Coordinador: usar inventario de un centro.
 * Crea asignación + misión logística + reserva `reserved` visible en Solicitudes.
 */
export async function requestInventoryFromCenter(input: {
  caseData: import('@/domain/case-lifecycle.types').CaseDomain
  centerId: string
  resourceType: string
  quantity: number
  actorId: string
}): Promise<{ reservation: InventoryReservation; missionId: string }> {
  const { assignmentService } = await import('@/services/assignment-service')
  const { missionService } = await import('@/services/mission-service')

  await assignmentService.assign(
    input.caseData.id,
    input.centerId,
    input.actorId,
    undefined,
    `Solicitud de inventario: ${input.quantity} × ${getResourceLabel(input.resourceType)}`,
  )

  const existingMissions = await missionService.listByCaseId(input.caseData.id)
  let mission = existingMissions[0]
  if (!mission) {
    const created = await missionService.create({
      centerId: input.centerId,
      title: input.caseData.title,
      description: input.caseData.description,
      priority: input.caseData.priority,
      requiredSkills: [],
      requiredPeople: 1,
      location: {
        lat: input.caseData.location.lat,
        lng: input.caseData.location.lng,
        address: input.caseData.location.address,
        zone: input.caseData.zone,
      },
      caseId: input.caseData.id,
      createdBy: input.actorId,
      pickupCenterId: input.centerId,
      resourceType: input.resourceType,
      resourceQty: input.quantity,
      deliveryAddress: input.caseData.location.address ?? input.caseData.zone,
    })
    mission = created.mission
  }

  const existingReservation = await logisticsRepository.findByMissionId(mission.id)
  if (
    existingReservation &&
    (existingReservation.status === 'reserved' || existingReservation.status === 'ready')
  ) {
    return { reservation: existingReservation, missionId: mission.id }
  }

  const reservation = await prepareMissionWithReservation({
    mission,
    caseId: input.caseData.id,
    centerId: input.centerId,
    resourceType: input.resourceType,
    quantity: Math.max(1, input.quantity),
    actorId: input.actorId,
  })

  return { reservation, missionId: mission.id }
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
    itemId: reservation.itemId ?? null,
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

/**
 * Respuesta operativa del coordinador a una solicitud del GC.
 * - brigade / delivery → confirma centro + marca ready
 * - needs_volunteer → cancela reserva y notifica al GC para abrir radar
 */
export async function respondToInventoryRequest(input: {
  reservationId: string
  resolutionMode: 'brigade' | 'delivery' | 'needs_volunteer' | 'declined'
  actorId: string
  notes?: string
  meta?: {
    responsibleName?: string
    etaMinutes?: number
    driverName?: string
    driverPhone?: string
    vehicle?: string
  }
}): Promise<InventoryReservation> {
  const { operationalLog } = await import('@/lib/operational-log')
  const { caseService } = await import('@/services/case-service')
  const { assignmentService } = await import('@/services/assignment-service')

  const { data: raw, error: rawErr } = await supabase
    .from('inventory_reservations')
    .select('*')
    .eq('id', input.reservationId)
    .maybeSingle()
  if (rawErr || !raw) throw new Error('Solicitud no encontrada')

  const caseId = String(raw.case_id)
  const centerId = String(raw.center_id)
  const missionId = String(raw.mission_id)
  if (String(raw.status) !== 'reserved') {
    throw new Error('Esta solicitud ya fue respondida')
  }

  operationalLog({
    entityType: 'mission',
    entityId: missionId,
    action: 'center_resolution_selected',
    caseId,
    centerId,
    actorId: input.actorId,
    actorRole: 'coordinator',
    source: 'service',
    payload: { resolutionMode: input.resolutionMode, notes: input.notes ?? null },
  })

  const caseData = await caseService.getById(caseId)
  if (input.resolutionMode === 'declined') {
    const reservation = await logisticsRepository.saveCoordinatorResolution({
      reservationId: input.reservationId,
      resolutionMode: 'declined',
      resolutionMeta: input.meta ?? {},
      coordinatorNotes: input.notes,
      status: 'cancelled',
    })

    if (caseData?.pipelineStage === 'awaiting_center_confirmation') {
      try {
        await assignmentService.rejectCenter(
          caseId,
          input.actorId,
          'El centro indicó que no puede cumplir con la solicitud',
        )
      } catch {
        // best effort
      }
    }

    const centerName = await getCenterDisplayName(centerId)
    const resourceLabel = getResourceLabel(reservation.resourceType)
    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['case_manager', 'regional_admin', 'super_admin'])
      .eq('status', 'active')

    await Promise.all(
      (managers ?? []).map((m) =>
        opsNotify({
          to: String(m.id),
          type: 'center_rejected',
          title: 'Centro no puede cubrir',
          message: `${centerName} no puede cubrir ${resourceLabel}. Asigna otro centro o publica la necesidad.`,
          priority: 'high',
          actionUrl: OPS_ACTION_URLS.gcCase(caseId),
          icon: 'x',
          metadata: {
            caseId,
            centerId,
            reservationId: reservation.id,
            notes: input.notes ?? null,
          },
          entityType: 'case',
          entityId: caseId,
          caseId,
          missionId,
          actorId: input.actorId,
        }),
      ),
    )

    logisticsLog('reservation_released', {
      entityId: reservation.id,
      entityType: 'mission',
      missionId,
      caseId,
      centerId,
      actorId: input.actorId,
      payload: { reason: 'declined', notes: input.notes ?? null },
    })

    return reservation
  }

  if (input.resolutionMode === 'needs_volunteer') {
    const reservation = await logisticsRepository.saveCoordinatorResolution({
      reservationId: input.reservationId,
      resolutionMode: 'needs_volunteer',
      resolutionMeta: input.meta ?? {},
      coordinatorNotes: input.notes,
    })

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
          message: `El centro confirma inventario para el caso, pero requiere voluntario para retirar y entregar.`,
          priority: 'high',
          actionUrl: OPS_ACTION_URLS.gcCase(caseId),
          icon: 'users',
          metadata: {
            caseId,
            centerId,
            reservationId: reservation.id,
            notes: input.notes ?? null,
          },
          entityType: 'case',
          entityId: caseId,
          caseId,
          missionId,
          actorId: input.actorId,
        }),
      ),
    )

    logisticsLog('reservation_released', {
      entityId: reservation.id,
      entityType: 'mission',
      missionId,
      caseId,
      centerId,
      actorId: input.actorId,
      payload: { reason: 'needs_volunteer', notes: input.notes ?? null },
    })

    return reservation
  }

  if (caseData?.pipelineStage === 'awaiting_center_confirmation') {
    await assignmentService.confirmCenter(caseId, input.actorId)
  }

  const reservation = await logisticsRepository.saveCoordinatorResolution({
    reservationId: input.reservationId,
    resolutionMode: input.resolutionMode,
    resolutionMeta: {
      ...(input.meta ?? {}),
      centerMissionStage: 'preparing',
    },
    coordinatorNotes: input.notes,
    status: 'ready',
  })

  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['case_manager', 'regional_admin', 'super_admin'])
    .eq('status', 'active')

  const centerName = await getCenterDisplayName(centerId)
  const resourceLabel = getResourceLabel(reservation.resourceType)
  await Promise.all(
    (managers ?? []).map((m) =>
      opsNotify({
        to: String(m.id),
        type: 'center_accepted_request',
        title: 'Centro aceptó cobertura',
        message: `${centerName} aceptó cubrir ${resourceLabel}. Estado: Preparando.`,
        priority: 'normal',
        actionUrl: OPS_ACTION_URLS.gcCase(caseId),
        icon: 'package',
        metadata: {
          caseId,
          centerId,
          reservationId: reservation.id,
          resolutionMode: input.resolutionMode,
          notes: input.notes ?? null,
        },
        entityType: 'case',
        entityId: caseId,
        caseId,
        missionId,
        actorId: input.actorId,
      }),
    ),
  )

  logisticsLog('reservation_ready', {
    entityId: reservation.id,
    entityType: 'mission',
    missionId,
    caseId,
    centerId,
    actorId: input.actorId,
    payload: {
      resolutionMode: input.resolutionMode,
      notes: input.notes ?? null,
      meta: input.meta ?? {},
    },
  })

  return reservation
}

/**
 * Coordinador avanza la misión interna del centro: Preparando → En camino → Entregado.
 * Usa resolution_meta.centerMissionStage (sin cambiar el esquema de status).
 */
export async function advanceCenterMissionStage(input: {
  reservationId: string
  toStage: 'en_route' | 'delivered'
  actorId?: string
  actorName?: string
  deliveredQuantity?: number
}): Promise<InventoryReservation> {
  const current = await logisticsRepository.findById(input.reservationId)
  if (!current) throw new Error('Solicitud no encontrada')
  if (current.status !== 'ready' && current.status !== 'delivered') {
    throw new Error('Esta misión aún no fue aceptada por el centro')
  }
  if (current.resolutionMode === 'declined' || current.resolutionMode === 'needs_volunteer') {
    throw new Error('Esta solicitud no usa el flujo de misión interna del centro')
  }

  if (input.toStage === 'en_route') {
    const reservation = await logisticsRepository.patchResolutionMeta(input.reservationId, {
      centerMissionStage: 'en_route',
      enRouteAt: new Date().toISOString(),
    })
    logisticsLog('reservation_ready', {
      entityId: reservation.id,
      entityType: 'mission',
      missionId: reservation.missionId,
      caseId: reservation.caseId,
      centerId: reservation.centerId,
      actorId: input.actorId,
      payload: { centerMissionStage: 'en_route' },
    })
    return reservation
  }

  // delivered
  const reservation = await markReservationDelivered(
    input.reservationId,
    input.actorId,
    input.actorName,
    input.deliveredQuantity,
  )
  await logisticsRepository.patchResolutionMeta(input.reservationId, {
    centerMissionStage: 'delivered',
    deliveredAt: new Date().toISOString(),
  }).catch(() => null)
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

  // Gap crítico Camino B: avisar al voluntario que los recursos están listos
  try {
    let volunteerRowId = reservation.volunteerId
    if (!volunteerRowId && reservation.missionId) {
      const assignments = await missionRepository.listAssignments(reservation.missionId)
      const active = assignments.find((a) =>
        ['assigned', 'accepted', 'preparing', 'en_route', 'on_site', 'in_progress'].includes(a.status),
      )
      volunteerRowId = active?.volunteerId
    }
    if (volunteerRowId) {
      const identity = await volunteerRepository.findIdentity(volunteerRowId)
      if (identity) {
        const resourceLabel = getResourceLabel(reservation.resourceType)
        await opsNotify({
          to: identity.userId,
          type: 'resources_ready',
          title: 'Recursos listos en el centro',
          message: `${reservation.quantity} × ${resourceLabel} están preparados. Puedes pasar a retirarlos.`,
          priority: 'high',
          actionUrl: OPS_ACTION_URLS.volunteerMissionAssigned(reservation.missionId),
          icon: 'package',
          metadata: {
            reservationId,
            missionId: reservation.missionId,
            caseId: reservation.caseId,
            centerId: reservation.centerId,
          },
          entityType: 'mission',
          entityId: reservation.missionId,
          caseId: reservation.caseId,
          missionId: reservation.missionId,
          actorId,
        })
      }
    }
  } catch {
    console.warn('[FARO_LOGISTICS] No se pudo notificar resources_ready al voluntario')
  }

  return reservation
}

/**
 * Marcar recursos entregados al voluntario (coordinador).
 * Libera la reserva y descuenta el stock real.
 */
export async function markReservationDelivered(
  reservationId: string,
  actorId?: string,
  actorName?: string,
  deliveredQuantity?: number,
): Promise<InventoryReservation> {
  const reservation =
    deliveredQuantity != null
      ? await logisticsRepository.deliverReservation({
          reservationId,
          deliveredQuantity,
        })
      : await logisticsRepository.updateReservationStatus(reservationId, 'delivered')

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

  try {
    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['case_manager', 'regional_admin', 'super_admin'])
      .eq('status', 'active')
    const centerName = await getCenterDisplayName(reservation.centerId)
    const resourceLabel = getResourceLabel(reservation.resourceType)
    await Promise.all(
      (managers ?? []).map((m) =>
        opsNotify({
          to: String(m.id),
          type: 'resources_delivered',
          title: 'Entrega lista para validar',
          message: `${centerName} marcó entregado ${reservation.quantity} × ${resourceLabel}. Valida y cierra el caso.`,
          priority: 'high',
          actionUrl: reservation.caseId
            ? OPS_ACTION_URLS.gcCase(reservation.caseId)
            : OPS_ACTION_URLS.gcBandeja(),
          icon: 'package',
          metadata: {
            caseId: reservation.caseId,
            reservationId: reservation.id,
            missionId: reservation.missionId,
          },
          entityType: 'mission',
          entityId: reservation.missionId,
          caseId: reservation.caseId,
          missionId: reservation.missionId,
          actorId,
        }),
      ),
    )
  } catch {
    // non-blocking
  }

  if (reservation.caseId) {
    try {
      const {
        getCaseCoverage,
        syncPublicNeedCoveredQuantity,
        reopenCoverageIfNeeded,
      } = await import('@/services/case-coverage-service')
      const coverage = await getCaseCoverage(reservation.caseId)
      await syncPublicNeedCoveredQuantity(reservation.caseId, coverage.covered)
      if (!coverage.complete) {
        const { caseService } = await import('@/services/case-service')
        const caseData = await caseService.getById(reservation.caseId)
        if (caseData) await reopenCoverageIfNeeded(caseData, actorId, coverage.remaining)
      }
    } catch {
      // non-blocking
    }
  }

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

export async function listReservationsByCenter(
  centerId: string,
  statuses?: Array<'reserved' | 'ready' | 'delivered' | 'released' | 'cancelled'>,
): Promise<InventoryReservation[]> {
  // Sin filtro: historial completo del centro (Solicitudes / Misiones / Historial filtran en UI).
  return logisticsRepository.listByCenter(centerId, statuses)
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

    const volunteerName = reservation.volunteerId
      ? await getVolunteerDisplayName(reservation.volunteerId)
      : null
    const resourceLabel = getResourceLabel(reservation.resourceType)
    const location =
      mission.location?.address?.split(',')[0]?.trim() ||
      mission.location?.zone ||
      mission.title
    const body = volunteerName
      ? `${volunteerName} reservó ${reservation.quantity} × ${resourceLabel} para ${location}.`
      : `Nueva solicitud: ${resourceLabel} para ${location}`

    for (const userId of coordinators) {
      await opsNotify({
        to: userId,
        type: 'logistics_preparation',
        title: volunteerName ? 'Reserva de voluntario' : 'Nueva solicitud logística',
        message: body,
        priority: 'high',
        actionUrl: OPS_ACTION_URLS.coordinatorNeeds(),
        icon: 'package',
        metadata: {
          reservationId: reservation.id,
          missionId: reservation.missionId,
          caseId: reservation.caseId,
          resourceType: reservation.resourceType,
          quantity: reservation.quantity,
          volunteerName,
        },
        entityType: 'mission',
        entityId: reservation.missionId,
        caseId: reservation.caseId,
        missionId: reservation.missionId,
      })
    }
  } catch {
    console.warn('[FARO_LOGISTICS] No se pudo notificar al coordinador del centro')
  }
}

async function getCenterDisplayName(centerId: string): Promise<string> {
  for (const table of ['hospitals', 'shelters', 'supply_centers'] as const) {
    const { data } = await supabase.from(table).select('name').eq('id', centerId).maybeSingle()
    const name = (data as { name?: string } | null)?.name
    if (name?.trim()) return name.trim()
  }
  return 'El centro'
}

export async function getCenterCoordinatorUserIds(centerId: string): Promise<string[]> {
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

/**
 * Voluntario reserva inventario en un centro (RPC atómica + TTL 20m).
 * Notifica al coordinador del centro.
 */
export async function reserveInventoryByVolunteer(input: {
  missionId: string
  caseId: string
  centerId: string
  resourceType: string
  quantity: number
  volunteerId?: string
  volunteerName?: string
  etaMinutes?: number
}): Promise<InventoryReservation> {
  await logisticsRepository.expireStaleReservations().catch(() => 0)

  const reservation = await logisticsRepository.reserveInventoryForMissionRpc({
    missionId: input.missionId,
    caseId: input.caseId,
    centerId: input.centerId,
    resourceType: input.resourceType,
    quantity: input.quantity,
    volunteerId: input.volunteerId,
    ttlMinutes: INVENTORY_RESERVATION_TTL_MINUTES,
  })

  opsChannelLog('RESERVATION', {
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'volunteer_reserved_inventory',
    caseId: input.caseId,
    missionId: input.missionId,
    centerId: input.centerId,
    volunteerId: input.volunteerId,
    from: null,
    to: 'reserved',
    payload: {
      quantity: input.quantity,
      resourceType: input.resourceType,
      expiresAt: reservation.expiresAt?.toISOString() ?? null,
    },
  })

  const coordinators = await getCenterCoordinatorUserIds(input.centerId)
  const name = input.volunteerName ?? 'Un voluntario'
  const resourceLabel = getResourceLabel(input.resourceType)
  const eta = input.etaMinutes != null ? `${input.etaMinutes} minutos` : 'por confirmar'

  await Promise.all(
    coordinators.map((userId) =>
      opsNotify({
        to: userId,
        type: 'logistics_preparation',
        title: 'Nuevo voluntario — reserva pendiente',
        message: `${name} reservó ${input.quantity} × ${resourceLabel}. ETA ${eta}.`,
        priority: 'high',
        actionUrl: OPS_ACTION_URLS.coordinatorNeeds(),
        icon: 'package',
        metadata: {
          reservationId: reservation.id,
          missionId: input.missionId,
          caseId: input.caseId,
          quantity: input.quantity,
          resourceType: input.resourceType,
          volunteerName: name,
          etaMinutes: input.etaMinutes ?? null,
        },
        entityType: 'reservation',
        entityId: reservation.id,
        caseId: input.caseId,
        missionId: input.missionId,
      }),
    ),
  )

  return reservation
}

/** Centro acepta reserva del voluntario → ready + notifica voluntario. */
export async function acceptVolunteerInventoryReservation(
  reservationId: string,
): Promise<InventoryReservation> {
  const reservation = await logisticsRepository.acceptInventoryReservationRpc(reservationId)

  opsChannelLog('CENTER', {
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'center_accepted_volunteer_reservation',
    caseId: reservation.caseId,
    missionId: reservation.missionId,
    centerId: reservation.centerId,
    from: 'reserved',
    to: 'ready',
  })

  const userId = reservation.volunteerUserId
  if (userId) {
    await opsNotify({
      to: userId,
      type: 'resources_ready',
      title: 'Centro confirmó tu retiro',
      message: 'Puedes dirigirte al centro. Ya tienes el contacto del coordinador.',
      priority: 'high',
      actionUrl: OPS_ACTION_URLS.volunteerMissionAssigned(reservation.missionId),
      icon: 'package',
      metadata: {
        reservationId: reservation.id,
        missionId: reservation.missionId,
        caseId: reservation.caseId,
        centerId: reservation.centerId,
      },
      entityType: 'reservation',
      entityId: reservation.id,
      caseId: reservation.caseId,
      missionId: reservation.missionId,
    })
  }

  // Actualizar pickup de la misión al centro aceptado
  try {
    await missionRepository.update(reservation.missionId, {
      pickupCenterId: reservation.centerId,
      resourceType: reservation.resourceType,
      resourceQty: reservation.quantity,
    })
  } catch {
    // non-blocking
  }

  return reservation
}

export async function sweepExpiredInventoryReservations(): Promise<number> {
  const count = await logisticsRepository.expireStaleReservations()
  if (count > 0) {
    opsChannelLog('INVENTORY', {
      entityType: 'reservation',
      entityId: 'batch',
      action: 'expire_stale_reservations',
      payload: { count },
    })
  }
  return count
}

export type { CenterRecommendation }
export type { RegisterSiteType }
