import {
  OPERATIONAL_MODES,
  SUPPORT_REQUEST_STATUSES,
  CENTER_EVENT_TYPES,
  type OperationalMode,
  type CenterResource,
  type CenterOperationalProfile,
  type SupportRequest,
  type SupportRequestInput,
  type CenterCapacityUpdate,
  type CenterEvent,
} from './center-operations.types'

export function calculateOccupancyPct(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

export function determineOperationalMode(
  occupancyPct: number,
  resources: CenterResource[],
  activeCases: number,
): OperationalMode {
  if (occupancyPct >= 100) return OPERATIONAL_MODES.SATURATED
  if (occupancyPct >= 90) return OPERATIONAL_MODES.EMERGENCY_ONLY

  const criticalResources = resources.filter((r) => r.maxLevel > 0 && r.currentLevel / r.maxLevel < 0.2)
  if (criticalResources.length >= 2) return OPERATIONAL_MODES.SATURATED
  if (criticalResources.length === 1) return OPERATIONAL_MODES.EMERGENCY_ONLY

  if (occupancyPct >= 75) return OPERATIONAL_MODES.LIMITED
  if (activeCases > 5 && occupancyPct > 50) return OPERATIONAL_MODES.LIMITED

  const depletedResources = resources.filter((r) => r.maxLevel > 0 && r.currentLevel <= 0)
  if (depletedResources.length > 0) return OPERATIONAL_MODES.LIMITED

  return OPERATIONAL_MODES.ACTIVE
}

export function canAcceptCase(profile: CenterOperationalProfile): { allowed: boolean; reason?: string } {
  if (profile.operationalMode === OPERATIONAL_MODES.INACTIVE) {
    return { allowed: false, reason: 'El centro está inactivo' }
  }
  if (profile.operationalMode === OPERATIONAL_MODES.SATURATED) {
    return { allowed: false, reason: 'El centro está saturado — no tiene capacidad para más casos' }
  }
  if (profile.operationalMode === OPERATIONAL_MODES.EMERGENCY_ONLY) {
    return { allowed: false, reason: 'El centro solo atiende emergencias activas' }
  }
  if (profile.occupancyPct >= 100) {
    return { allowed: false, reason: 'Capacidad máxima alcanzada' }
  }
  return { allowed: true }
}

export function validateSupportRequest(input: SupportRequestInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('El título es requerido')
  if (!input.description.trim()) errors.push('La descripción es requerida')
  if (input.quantity <= 0) errors.push('La cantidad debe ser mayor a 0')
  if (input.durationHours && input.durationHours <= 0) errors.push('La duración debe ser mayor a 0')
  return { valid: errors.length === 0, errors }
}

export function computeResourceCoverage(resources: CenterResource[]): number {
  const active = resources.filter((r) => r.maxLevel > 0)
  if (active.length === 0) return 100
  const total = active.reduce((sum, r) => sum + r.currentLevel / r.maxLevel, 0)
  return Math.round((total / active.length) * 100)
}

export function computeOccupancyDetailTotal(detail: {
  adults: number
  children: number
  elderly: number
  disabledMobility: number
}): number {
  return detail.adults + detail.children + detail.elderly + detail.disabledMobility
}

export function buildCapacityUpdateEvent(
  update: CenterCapacityUpdate,
  previousOccupancy: number,
  actorName?: string,
): { event: CenterEvent; newOccupancyPct: number } {
  const now = new Date()
  return {
    event: {
      id: crypto.randomUUID(),
      centerId: update.centerId,
      eventType: CENTER_EVENT_TYPES.CAPACITY_UPDATED,
      previousValue: String(previousOccupancy),
      newValue: update.current !== undefined ? String(update.current) : undefined,
      actorId: update.actorId,
      actorName: update.actorName ?? actorName,
      description: `Capacidad actualizada: ${previousOccupancy} → ${update.current ?? 'sin cambio'} personas`,
      createdAt: now,
    },
    newOccupancyPct: update.current !== undefined && update.total
      ? calculateOccupancyPct(update.current, update.total)
      : previousOccupancy,
  }
}

export function canCreateSupportRequest(
  recentRequests: SupportRequest[],
): { allowed: boolean; reason?: string } {
  const recent = recentRequests.filter(
    (r) => r.status === SUPPORT_REQUEST_STATUSES.OPEN || r.status === SUPPORT_REQUEST_STATUSES.IN_PROGRESS,
  )
  if (recent.length >= 3) {
    return { allowed: false, reason: 'Ya hay 3 solicitudes activas. Resuelve o cancela algunas antes de crear una nueva.' }
  }
  return { allowed: true }
}
