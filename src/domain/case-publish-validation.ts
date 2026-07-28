import type { CaseDomain, CasePriority } from '@/domain/case-lifecycle.types'

export interface PublishCaseFields {
  location?: { lat?: number; lng?: number } | null
  category?: string | null
  priority?: CasePriority | string | null
  quantity?: number | null
  responsibleId?: string | null
  destination?: string | null
}

export function hasValidCoordinates(location?: { lat?: number; lng?: number } | null): boolean {
  if (!location) return false
  const { lat, lng } = location
  if (lat == null || lng == null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  return true
}

/**
 * Valida campos mínimos antes de publicar / abrir radar / transferir / asignar.
 */
export function assertCaseReadyToPublish(fields: PublishCaseFields): void {
  const errors: string[] = []

  if (!hasValidCoordinates(fields.location)) {
    errors.push('ubicación con coordenadas válidas')
  }
  if (!fields.category?.trim()) {
    errors.push('categoría')
  }
  if (!fields.priority) {
    errors.push('prioridad')
  }
  if (fields.quantity == null || !Number.isFinite(fields.quantity) || fields.quantity < 1) {
    errors.push('cantidad')
  }
  if (!fields.responsibleId?.trim()) {
    errors.push('responsable')
  }
  if (!fields.destination?.trim()) {
    errors.push('destino')
  }

  if (errors.length > 0) {
    throw new Error(`No se puede publicar la solicitud. Falta: ${errors.join(', ')}.`)
  }
}

/**
 * Radar: exige destino/prioridad/responsable; coords recomendadas pero
 * permite abrir si hay zona (mapa usará coordenadas del caso o fallback).
 */
export function assertCaseReadyForRadar(
  caseData: CaseDomain,
  actorId?: string,
): void {
  const errors: string[] = []
  if (!caseData.priority) errors.push('prioridad')
  if (!caseData.zone?.trim() && !caseData.assignedCenterId) errors.push('destino')
  if (!(actorId ?? caseData.assignedTo)?.trim()) errors.push('responsable')
  if ((caseData.affectedCount ?? 0) < 1) errors.push('cantidad')
  if (errors.length > 0) {
    throw new Error(`No se puede abrir el radar. Falta: ${errors.join(', ')}.`)
  }
}

export function assertCaseDomainReadyToPublish(
  caseData: CaseDomain,
  actorId?: string,
): void {
  assertCaseReadyToPublish({
    location: caseData.location,
    category: caseData.category,
    priority: caseData.priority,
    quantity: caseData.affectedCount,
    responsibleId: actorId ?? caseData.assignedTo,
    destination: caseData.zone || caseData.assignedCenterId,
  })
}
