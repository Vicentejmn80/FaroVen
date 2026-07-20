import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { caseRepository } from '@/repositories/case-repository'

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

    return assignment
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
