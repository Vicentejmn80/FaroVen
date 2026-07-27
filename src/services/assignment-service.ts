import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { caseRepository } from '@/repositories/case-repository'
import { caseService } from '@/services/case-service'
import { operationalLog } from '@/lib/operational-log'

export interface CenterInfo {
  id: string
  name: string
  lat: number
  lng: number
  status: string
  saturation?: 'low' | 'medium' | 'high' | 'critical'
  activeNeedsCount?: number
}

export interface AssignmentSuggestion {
  centerId: string
  centerName: string
  distance: string
  distanceKm: number
  saturation: 'low' | 'medium' | 'high' | 'critical'
  status: string
  score: number
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
  return km < 1
    ? `Muy cercano (${Math.round(km * 1000)}m)`
    : km < 3
      ? `Cercano (${km.toFixed(1)}km)`
      : km < 8
        ? `Moderado (${km.toFixed(1)}km)`
        : `Lejano (${km.toFixed(1)}km)`
}

function calculateScore(
  center: CenterInfo,
  distanceKm: number,
): number {
  let score = 50
  score -= distanceKm * 2
  const sat = center.saturation ?? 'low'
  if (sat === 'critical') score -= 30
  else if (sat === 'high') score -= 15
  else if (sat === 'medium') score -= 5
  if (center.status === 'operational') score += 20
  else if (center.status === 'warning') score -= 5
  else if (center.status === 'critical') score -= 40
  return Math.max(0, Math.min(100, score))
}

export const assignmentService = {
  suggestCenters(caseData: CaseDomain, centers: CenterInfo[]): AssignmentSuggestion[] {
    const lat = caseData.location.lat
    const lng = caseData.location.lng
    if (!lat && !lng) return []

    const suggestions = centers
      .map((c) => {
        const dist = haversineDistance(lat, lng, c.lat, c.lng)
        const score = calculateScore(c, dist)
        return {
          centerId: c.id,
          centerName: c.name,
          distance: formatDistance(dist),
          distanceKm: dist,
          saturation: c.saturation ?? 'low',
          status: c.status,
          score,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    return suggestions
  },

  async assign(
    caseId: string,
    centerId: string,
    assignedBy: string,
    assignedTo?: string,
    reason?: string,
  ) {
    const caseData = await caseRepository.findById(caseId)
    if (!caseData) throw new Error(`Caso no encontrado: ${caseId}`)

    const assignment = await caseRepository.createAssignment({
      caseId,
      centerId,
      assignedBy,
      assignedTo,
      reason,
    })

    await caseRepository.update(caseId, {
      assignedCenterId: centerId,
      assignedTo,
      assignedAt: new Date(),
    })

    // No marcar ASIGNADO todavía: esperar confirmación del centro (GC puede confirmar).
    const stage = caseData.pipelineStage
    if (
      stage === 'pending_review' ||
      stage === 'validating' ||
      stage === 'awaiting_info' ||
      stage === 'open_for_applications'
    ) {
      await caseService.transition(
        caseId,
        'awaiting_center_confirmation',
        assignedBy || undefined,
        reason ?? `Propuesto a centro ${centerId} — esperando confirmación`,
      )
    }

    operationalLog({
      entityType: 'case',
      entityId: caseId,
      action: 'assign_center_proposed',
      from: stage,
      to: 'awaiting_center_confirmation',
      actorId: assignedBy || null,
      centerId,
      source: 'service',
      payload: { assignmentId: assignment.id, reason },
    })

    return assignment
  },

  /** GC confirma por el centro → ahora sí ASIGNADO. */
  async confirmCenter(caseId: string, actorId?: string) {
    const caseData = await caseRepository.findById(caseId)
    if (!caseData) throw new Error(`Caso no encontrado: ${caseId}`)
    if (caseData.pipelineStage !== 'awaiting_center_confirmation') {
      throw new Error('El caso no está esperando confirmación del centro')
    }
    const result = await caseService.transition(
      caseId,
      'assigned',
      actorId,
      'Centro confirmó — caso asignado',
    )
    operationalLog({
      entityType: 'case',
      entityId: caseId,
      action: 'center_confirmed',
      from: 'awaiting_center_confirmation',
      to: 'assigned',
      actorId: actorId ?? null,
      centerId: caseData.assignedCenterId ?? null,
      source: 'service',
    })
    return result
  },

  /** Sin respuesta del centro → volver a revisión. */
  async rejectCenter(caseId: string, actorId?: string, reason?: string) {
    const caseData = await caseRepository.findById(caseId)
    if (!caseData) throw new Error(`Caso no encontrado: ${caseId}`)
    if (caseData.pipelineStage !== 'awaiting_center_confirmation') {
      throw new Error('El caso no está esperando confirmación del centro')
    }
    const result = await caseService.transition(
      caseId,
      'pending_review',
      actorId,
      reason ?? 'Centro sin respuesta — caso vuelve a revisión',
    )
    operationalLog({
      entityType: 'case',
      entityId: caseId,
      action: 'center_rejected',
      from: 'awaiting_center_confirmation',
      to: 'pending_review',
      actorId: actorId ?? null,
      centerId: caseData.assignedCenterId ?? null,
      source: 'service',
      payload: { reason },
    })
    return result
  },

  async acceptAssignment(assignmentId: string) {
    return caseRepository.updateAssignment(assignmentId, {
      status: 'accepted',
      acceptedAt: new Date(),
    })
  },

  async rejectAssignment(assignmentId: string, reason?: string) {
    return caseRepository.updateAssignment(assignmentId, {
      status: 'rejected',
      rejectedAt: new Date(),
      reason,
    })
  },

  async listByCase(caseId: string) {
    return caseRepository.listAssignments(caseId)
  },
}
