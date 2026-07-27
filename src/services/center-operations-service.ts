import { centerOpsRepository } from '@/repositories/center-operations-repository'
import {
  determineOperationalMode,
  calculateOccupancyPct,
  canAcceptCase,
  validateSupportRequest,
  computeResourceCoverage,
  computeOccupancyDetailTotal,
  buildCapacityUpdateEvent,
  canCreateSupportRequest,
} from '@/domain/center-operations.service'
import { caseRepository } from '@/repositories/case-repository'
import {
  type CenterResource,
  type CenterEvent,
  type SupportRequest,
  type SupportRequestInput,
  type CenterCapacityUpdate,
  type CenterOperationalProfile,
  CENTER_EVENT_TYPES,
} from '@/domain/center-operations.types'
import type { RegisterSiteType } from '@/repositories/types'
import {
  getResourceCatalogItem,
  getResourceMinRecommended,
  getResourceUnit,
} from '@/lib/resource-catalog'

export async function getCenterProfile(
  centerId: string,
  siteType: RegisterSiteType,
): Promise<CenterOperationalProfile> {
  const [resources, mode, events, activeCaseCount, occupancyPct] = await Promise.all([
    centerOpsRepository.getResources(centerId),
    centerOpsRepository.getOperationalMode(centerId, siteType),
    centerOpsRepository.getEvents(centerId),
    caseRepository.countActiveByCenter(centerId),
    centerOpsRepository.getOccupancyPct(centerId, siteType),
  ])

  const coveragePct = computeResourceCoverage(resources)

  return {
    centerId,
    siteType,
    operationalMode: mode,
    resources,
    occupancyPct,
    resourceCoveragePct: coveragePct,
    activeCaseCount,
    recentEvents: events.slice(0, 10),
  }
}

export async function refreshOperationalMode(
  centerId: string,
  siteType: RegisterSiteType,
  occupancyPct: number,
  resources: CenterResource[],
  actorId?: string,
  actorName?: string,
): Promise<{ previousMode: string; newMode: string }> {
  const activeCaseCount = await caseRepository.countActiveByCenter(centerId)
  const newMode = determineOperationalMode(occupancyPct, resources, activeCaseCount)
  const previousMode = await centerOpsRepository.getOperationalMode(centerId, siteType)
  if (previousMode !== newMode) {
    await centerOpsRepository.updateOperationalMode(centerId, siteType, newMode)
    await centerOpsRepository.createEvent({
      centerId,
      eventType: CENTER_EVENT_TYPES.OPERATIONAL_MODE_CHANGED,
      previousValue: previousMode,
      newValue: newMode,
      actorId,
      actorName,
      description: `Modo operativo cambiado de ${previousMode} a ${newMode}`,
    })
  }
  return { previousMode, newMode }
}

export async function updateCenterCapacity(
  centerId: string,
  siteType: RegisterSiteType,
  update: CenterCapacityUpdate,
  actorId?: string,
  actorName?: string,
): Promise<void> {
  const { event, newOccupancyPct } = buildCapacityUpdateEvent(update, 0, actorName)
  await centerOpsRepository.updateCapacity(centerId, siteType, {
    current: update.current,
    total: update.total,
    adults: update.occupancyDetail?.adults,
    children: update.occupancyDetail?.children,
    elderly: update.occupancyDetail?.elderly,
    disabledMobility: update.occupancyDetail?.disabledMobility,
  })
  await centerOpsRepository.createEvent(event)
  const resources = await centerOpsRepository.getResources(centerId)
  await refreshOperationalMode(centerId, siteType, newOccupancyPct, resources, actorId, actorName)
}

export async function createSupportRequest(
  input: SupportRequestInput,
  centerId: string,
): Promise<{ success: boolean; request?: SupportRequest; errors: string[] }> {
  const validation = validateSupportRequest(input)
  if (!validation.valid) return { success: false, errors: validation.errors }

  const recent = await centerOpsRepository.getSupportRequests(centerId)
  const canCreate = canCreateSupportRequest(recent)
  if (!canCreate.allowed) return { success: false, errors: [canCreate.reason!] }

  const request = await centerOpsRepository.createSupportRequest({
    centerId,
    requestType: input.requestType,
    title: input.title,
    description: input.description,
    urgency: input.urgency,
    quantity: input.quantity,
    durationHours: input.durationHours,
    createdBy: input.createdBy,
  })

  await centerOpsRepository.createEvent({
    centerId,
    eventType: CENTER_EVENT_TYPES.SUPPORT_REQUESTED,
    newValue: input.requestType,
    actorId: input.createdBy,
    description: `Solicitud de apoyo creada: ${input.title}`,
  })

  return { success: true, request, errors: [] }
}

export async function getCenterSupportRequests(centerId: string): Promise<SupportRequest[]> {
  return centerOpsRepository.getSupportRequests(centerId)
}

export async function getCenterResources(centerId: string): Promise<CenterResource[]> {
  return centerOpsRepository.getResources(centerId)
}

export async function getInventoryMovements(centerId: string) {
  return centerOpsRepository.listMovements(centerId)
}

export async function updateCenterResource(
  centerId: string,
  siteType: RegisterSiteType,
  resourceType: string,
  currentLevel: number,
  maxLevel: number,
  unit: string,
  actorId?: string,
  actorName?: string,
): Promise<CenterResource> {
  const existing = (await centerOpsRepository.getResources(centerId)).find(
    (r) => r.resourceType === resourceType,
  )
  const previous = existing?.currentLevel ?? 0

  const resource = await centerOpsRepository.upsertResource({
    centerId,
    resourceType,
    currentLevel,
    maxLevel: Math.max(maxLevel, currentLevel, existing?.maxLevel ?? 0),
    unit,
    minLevel: existing?.minLevel,
  })

  const delta = currentLevel - previous
  if (delta !== 0) {
    await centerOpsRepository.createMovement({
      centerId,
      resourceType,
      delta,
      balanceAfter: currentLevel,
      reason: 'adjustment',
      sourceLabel: 'Ajuste de inventario',
      actorId,
      actorName,
    })
  }

  await centerOpsRepository.createEvent({
    centerId,
    eventType: CENTER_EVENT_TYPES.RESOURCE_UPDATED,
    previousValue: String(previous),
    newValue: String(currentLevel),
    actorId,
    actorName,
    description: `Recurso ${resourceType} actualizado: ${previous} → ${currentLevel} ${unit}`,
  })

  const occupancyPct = await centerOpsRepository.getOccupancyPct(centerId, siteType)
  const resources = await centerOpsRepository.getResources(centerId)
  await refreshOperationalMode(centerId, siteType, occupancyPct, resources, actorId, actorName)

  return resource
}

/** Alta o actualización desde catálogo (cantidad = disponible). */
export async function setCatalogInventoryItem(input: {
  centerId: string
  siteType: RegisterSiteType
  resourceType: string
  quantity: number
  actorId?: string
  actorName?: string
  reason?: 'donation' | 'adjustment' | 'intake'
  sourceLabel?: string
}): Promise<CenterResource> {
  const catalog = getResourceCatalogItem(input.resourceType)
  if (!catalog) throw new Error('Recurso no está en el catálogo central')

  const existing = (await centerOpsRepository.getResources(input.centerId)).find(
    (r) => r.resourceType === input.resourceType,
  )
  const previous = existing?.currentLevel ?? 0
  const quantity = Math.max(0, Math.floor(input.quantity))

  const resource = await centerOpsRepository.upsertResource({
    centerId: input.centerId,
    resourceType: input.resourceType,
    currentLevel: quantity,
    maxLevel: Math.max(existing?.maxLevel ?? 0, quantity, getResourceMinRecommended(input.resourceType)),
    minLevel: existing?.minLevel ?? getResourceMinRecommended(input.resourceType),
    unit: getResourceUnit(input.resourceType),
    category: catalog.category,
  })

  const delta = quantity - previous
  if (delta !== 0) {
    await centerOpsRepository.createMovement({
      centerId: input.centerId,
      resourceType: input.resourceType,
      delta,
      balanceAfter: quantity,
      reason: input.reason ?? (existing ? 'adjustment' : 'intake'),
      sourceLabel: input.sourceLabel ?? (existing ? 'Ajuste' : 'Alta de inventario'),
      actorId: input.actorId,
      actorName: input.actorName,
    })
  }

  await centerOpsRepository.createEvent({
    centerId: input.centerId,
    eventType: existing ? CENTER_EVENT_TYPES.RESOURCE_UPDATED : CENTER_EVENT_TYPES.RESOURCE_ADDED,
    previousValue: String(previous),
    newValue: String(quantity),
    actorId: input.actorId,
    actorName: input.actorName,
    description: `${catalog.label}: ${previous} → ${quantity} ${catalog.unit}`,
  })

  return resource
}

export async function removeCatalogInventoryItem(input: {
  centerId: string
  resourceType: string
  actorId?: string
  actorName?: string
}): Promise<void> {
  const existing = (await centerOpsRepository.getResources(input.centerId)).find(
    (r) => r.resourceType === input.resourceType,
  )
  if (!existing) return

  await centerOpsRepository.deleteResource(input.centerId, input.resourceType)
  await centerOpsRepository.createMovement({
    centerId: input.centerId,
    resourceType: input.resourceType,
    delta: -existing.currentLevel,
    balanceAfter: 0,
    reason: 'outflow',
    sourceLabel: 'Eliminado del inventario',
    actorId: input.actorId,
    actorName: input.actorName,
  })
  await centerOpsRepository.createEvent({
    centerId: input.centerId,
    eventType: CENTER_EVENT_TYPES.RESOURCE_REMOVED,
    previousValue: String(existing.currentLevel),
    newValue: '0',
    actorId: input.actorId,
    actorName: input.actorName,
    description: `Eliminado ${input.resourceType} del inventario`,
  })
}

/** Consulta para Gestor de Casos: centros con stock del recurso. */
export async function findCentersWithStock(resourceType: string, minQty = 1) {
  return centerOpsRepository.findCentersWithResource(resourceType, minQty)
}

export async function getCenterEvents(centerId: string): Promise<CenterEvent[]> {
  return centerOpsRepository.getEvents(centerId)
}

export { canAcceptCase, validateSupportRequest, computeResourceCoverage, computeOccupancyDetailTotal, calculateOccupancyPct }
