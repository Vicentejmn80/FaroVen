import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { recommendCenters } from '@/services/logistics-service'
import { resolveCaseResource } from '@/domain/case-resource'

export type CenterDispatchMode = 'brigade' | 'needs_volunteers' | 'mixed'

export interface FaroCenterRecommendation {
  centerId: string
  centerName: string
  available: number
  unit: string
  distanceKm: number
  operationalMode: string
  dispatchMode: CenterDispatchMode
  dispatchModeLabel: string
  score: number
  matchPct: number
  resourceType: string
  resourceLabel: string
  requiredQty: number
}

export interface FaroRecommendationResult {
  resourceType: string
  resourceLabel: string
  requiredQty: number
  centers: FaroCenterRecommendation[]
  /** true si no hay centros con el recurso solicitado. */
  noMatchingInventory: boolean
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function dispatchModeLabel(mode: CenterDispatchMode): string {
  if (mode === 'brigade') return 'Brigada propia'
  if (mode === 'needs_volunteers') return 'Necesita voluntarios'
  return 'Mixto'
}

function scoreDispatchMode(mode: CenterDispatchMode): number {
  if (mode === 'brigade') return 10
  if (mode === 'mixed') return 6
  return 2
}

function scoreOperationalMode(mode: string): number {
  if (mode === 'active') return 10
  if (mode === 'limited') return 5
  if (mode === 'emergency_only') return -5
  if (mode === 'saturated') return -10
  if (mode === 'inactive') return -20
  return 0
}

function computeScore(input: {
  requiredQty: number
  available: number
  distanceKm: number
  operationalMode: string
  dispatchMode: CenterDispatchMode
}): number {
  const qtyRatio = input.requiredQty > 0 ? input.available / input.requiredQty : 1
  const qtyScore = 35 * clamp(qtyRatio, 0, 1.5)
  const distanceScore = 40 - clamp(input.distanceKm, 0, 15) * 2.4
  const opScore = scoreOperationalMode(input.operationalMode)
  const dispatchScore = scoreDispatchMode(input.dispatchMode)
  const raw = qtyScore + distanceScore + opScore + dispatchScore
  return clamp(Math.round(raw), 0, 100)
}

/**
 * Motor FARO: recomienda solo centros con el recurso EXACTO del caso.
 * No usa fallback a "agua" cuando el recurso no está en catálogo.
 */
export async function buildFaroRecommendations(caseData: CaseDomain): Promise<FaroRecommendationResult> {
  const resource = resolveCaseResource(caseData)

  const centers = await recommendCenters({
    itemId: resource.itemId,
    resourceType: resource.resourceType,
    resourceLabel: resource.resourceLabel,
    minQty: 1,
    missionLat: caseData.location.lat,
    missionLng: caseData.location.lng,
    limit: 8,
  }).catch(() => [])

  const enriched = centers.map((c) => {
    const rawDispatch = (c as { dispatchMode?: string | null }).dispatchMode
    const dispatchMode: CenterDispatchMode =
      rawDispatch === 'brigade' || rawDispatch === 'needs_volunteers' || rawDispatch === 'mixed'
        ? rawDispatch
        : 'mixed'
    const score = computeScore({
      requiredQty: resource.requiredQty,
      available: c.available,
      distanceKm: c.distanceKm,
      operationalMode: c.operationalMode,
      dispatchMode,
    })
    return {
      centerId: c.centerId,
      centerName: c.centerName,
      available: c.available,
      unit: c.unit,
      distanceKm: c.distanceKm,
      operationalMode: c.operationalMode,
      dispatchMode,
      dispatchModeLabel: dispatchModeLabel(dispatchMode),
      score,
      matchPct: score,
      resourceType: resource.resourceType,
      resourceLabel: resource.resourceLabel,
      requiredQty: resource.requiredQty,
    } satisfies FaroCenterRecommendation
  })

  enriched.sort((a, b) => b.score - a.score)

  return {
    resourceType: resource.resourceType,
    resourceLabel: resource.resourceLabel,
    requiredQty: resource.requiredQty,
    centers: enriched,
    noMatchingInventory: enriched.length === 0,
  }
}
