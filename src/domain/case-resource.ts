import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { getResourceLabel, resolveCatalogKey } from '@/lib/resource-catalog'

export interface CaseResourceSpec {
  /** UUID de items_catalog si existe. */
  itemId?: string
  /** Clave de catálogo o texto libre del recurso (nunca un default incorrecto). */
  resourceType: string
  /** Etiqueta humana para UI. */
  resourceLabel: string
  /** Unidades necesarias del caso. */
  requiredQty: number
}

/** Resuelve el recurso exacto del caso (sin caer a "agua" por defecto). */
export function resolveCaseResource(caseData: CaseDomain): CaseResourceSpec {
  const desc = caseData.description ?? ''
  const needMatch = desc.match(/Necesidad:\s*([^·\n]+)/i)
  const reqMatch = desc.match(/Requerido:\s*(\d+)/i)
  const titleResource = caseData.title
    .replace(/^E2E\s*[—\-–]\s*/i, '')
    .replace(/^Prioritario:\s*/i, '')
    .replace(/^Necesidad de\s+/i, '')
    .split(/\s+en\s+/i)[0]
    ?.split(/\s*[—–-]\s*/)[0]
    ?.trim()

  const meta = caseData.metadata as
    | { requiredQuantity?: number; resolvedItemId?: string; resourceType?: string }
    | undefined

  const rawLabel =
    needMatch?.[1]?.trim() ||
    caseData.category?.trim() ||
    titleResource ||
    (typeof meta?.resourceType === 'string' ? meta.resourceType : '') ||
    'recurso'

  const catalogKey = resolveCatalogKey(rawLabel) ?? resolveCatalogKey(caseData.category)
  const resourceType = catalogKey ?? normalizeResourceKey(rawLabel)
  const resourceLabel = catalogKey ? getResourceLabel(catalogKey) : rawLabel

  const requiredQty = Math.max(
    1,
    Number(meta?.requiredQuantity) ||
      (reqMatch?.[1] ? Number(reqMatch[1]) : 0) ||
      caseData.affectedCount ||
      1,
  )

  return {
    itemId: caseData.itemId ?? meta?.resolvedItemId,
    resourceType,
    resourceLabel,
    requiredQty,
  }
}

function normalizeResourceKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}
