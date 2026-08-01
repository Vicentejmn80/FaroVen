import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { recommendCenters, type CenterRecommendation } from '@/services/logistics-service'
import { caseApplicationService } from '@/services/case-application-service'
import { resolveCatalogKey, getResourceLabel } from '@/lib/resource-catalog'
import { supabase } from '@/lib/supabase'

export type RecoPath = 'inventory' | 'volunteers' | 'institution'

export interface OperationalRecommendation {
  primary: RecoPath
  headline: string
  estimatedMinutes: number
  paths: Array<{
    id: RecoPath
    title: string
    detail: string
    score: number
  }>
  inventory: CenterRecommendation[]
  pendingApplications: number
  resourceLabel: string
  minQty: number
}

/**
 * Heurística operacional V1 (reemplazable por IA sin cambiar UI).
 * Prioriza inventario local > voluntarios cerca > institución.
 */
export async function buildOperationalRecommendation(
  caseData: CaseDomain,
): Promise<OperationalRecommendation> {
  const legacyKey = resolveCatalogKey(caseData.category) ?? caseData.category ?? 'agua'
  let resourceLabel = getResourceLabel(legacyKey)
  const itemId = caseData.itemId

  if (itemId) {
    const { data } = await supabase
      .from('items_catalog')
      .select('canonical_name, key')
      .eq('id', itemId)
      .maybeSingle()
    if (data?.canonical_name) resourceLabel = String(data.canonical_name)
  }

  const minQty = Math.max(1, caseData.affectedCount || 1)

  const [inventory, applications] = await Promise.all([
    recommendCenters({
      itemId: itemId ?? undefined,
      resourceType: legacyKey,
      minQty,
      missionLat: caseData.location.lat,
      missionLng: caseData.location.lng,
      limit: 5,
    }).catch(() => [] as CenterRecommendation[]),
    caseApplicationService.listByCase(caseData.id).catch(() => []),
  ])

  const pendingApplications = applications.filter(
    (a) => a.status === 'pending' || a.status === 'under_review',
  ).length

  const nearestKm = inventory[0]?.distanceKm ?? 12
  const inventoryScore = inventory.length > 0 ? 90 - Math.min(40, nearestKm * 4) : 10
  const volunteerScore =
    pendingApplications > 0
      ? 55 + Math.min(30, pendingApplications * 8)
      : caseData.pipelineStage === 'open_for_applications'
        ? 45
        : 25
  const institutionScore =
    caseData.operationType === 'transfer' || caseData.category?.includes('medico') ? 50 : 30

  const paths: OperationalRecommendation['paths'] = (
    [
      {
        id: 'inventory' as const,
        title: inventory.length
          ? `${inventory[0].centerName} tiene ${inventory[0].available} de ${resourceLabel}`
          : 'Sin inventario cercano suficiente',
        detail: inventory.length
          ? `a ${inventory[0].distanceKm.toFixed(1)} km · ${inventory.length} nodo(s)`
          : 'Abrir cobertura voluntaria o escalar institución',
        score: inventoryScore,
      },
      {
        id: 'volunteers' as const,
        title:
          pendingApplications > 0
            ? `${pendingApplications} voluntario(s) postulados`
            : 'Abrir cobertura a voluntarios cercanos',
        detail: 'Convocatoria pública / radar',
        score: volunteerScore,
      },
      {
        id: 'institution' as const,
        title: 'Escalar a institución (Protección Civil / organismo)',
        detail: 'Cuando el caso requiere capacidad institucional',
        score: institutionScore,
      },
    ] satisfies OperationalRecommendation['paths']
  ).sort((a, b) => b.score - a.score)

  const primary = paths[0]?.id ?? 'volunteers'
  const estimatedMinutes =
    primary === 'inventory'
      ? Math.round(18 + nearestKm * 4)
      : primary === 'volunteers'
        ? 35 + pendingApplications * 2
        : 55

  const headlines: Record<RecoPath, string> = {
    inventory: 'Asignar primero inventario existente',
    volunteers: 'Abrir o aprobar cobertura voluntaria',
    institution: 'Escalar a institución responsable',
  }

  return {
    primary,
    headline: headlines[primary],
    estimatedMinutes,
    paths,
    inventory,
    pendingApplications,
    resourceLabel,
    minQty,
  }
}

export const operationalRecommendationService = {
  recommend: buildOperationalRecommendation,
}
