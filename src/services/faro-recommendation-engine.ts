import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { recommendCenters } from '@/services/logistics-service'
import { resolveCatalogKey, getResourceLabel } from '@/lib/resource-catalog'

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
  // Preferencia suave: todos siguen siendo válidos.
  if (mode === 'brigade') return 10
  if (mode === 'mixed') return 6
  return 2
}

function scoreOperationalMode(mode: string): number {
  // Basado en `operational_mode` existente (active/limited/saturated/etc).
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
  const qtyScore = 35 * clamp(qtyRatio, 0, 1.5) // 0..52.5
  const distanceScore = 40 - clamp(input.distanceKm, 0, 15) * 2.4 // 40..4
  const opScore = scoreOperationalMode(input.operationalMode)
  const dispatchScore = scoreDispatchMode(input.dispatchMode)
  const raw = qtyScore + distanceScore + opScore + dispatchScore
  return clamp(Math.round(raw), 0, 100)
}

/**
 * Motor FARO (reglas): recomienda centros usando inventario + distancia + estado operativo
 * y modo de despacho (si está disponible).
 *
 * NOTA: `dispatchMode` se resuelve desde `CenterRecommendation.operationalMode` si aún no existe
 * una columna real; al introducir `dispatch_mode` en DB, el mapper puede poblarla sin romper el motor.
 */
export async function buildFaroRecommendations(caseData: CaseDomain): Promise<FaroRecommendationResult> {
  const resourceType = resolveCatalogKey(caseData.category) ?? 'agua'
  const requiredQty = Math.max(1, caseData.affectedCount || 1)
  const resourceLabel = getResourceLabel(resourceType)

  const centers = await recommendCenters({
    resourceType,
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
      requiredQty,
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
      resourceType,
      resourceLabel,
      requiredQty,
    } satisfies FaroCenterRecommendation
  })

  enriched.sort((a, b) => b.score - a.score)

  return {
    resourceType,
    resourceLabel,
    requiredQty,
    centers: enriched,
  }
}

