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
  const resource = await centerOpsRepository.upsertResource({
    centerId,
    resourceType,
    currentLevel,
    maxLevel,
    unit,
  })

  await centerOpsRepository.createEvent({
    centerId,
    eventType: CENTER_EVENT_TYPES.RESOURCE_UPDATED,
    previousValue: String(resource.currentLevel),
    newValue: String(currentLevel),
    actorId,
    actorName,
    description: `Recurso ${resourceType} actualizado: ${resource.currentLevel} → ${currentLevel} ${unit}`,
  })

  const occupancyPct = 0
  const resources = await centerOpsRepository.getResources(centerId)
  await refreshOperationalMode(centerId, siteType, occupancyPct, resources, actorId, actorName)

  return resource
}

export async function getCenterEvents(centerId: string): Promise<CenterEvent[]> {
  return centerOpsRepository.getEvents(centerId)
}

export { canAcceptCase, validateSupportRequest, computeResourceCoverage, computeOccupancyDetailTotal, calculateOccupancyPct }
