import type { NeedPriority } from '@/lib/types'
import { getFreshnessLevel } from '@/lib/utils'
import type { MapEntity } from './useMapData'

export interface SummaryItem {
  item: string
  deficit: number
  unit: string
  priority: NeedPriority
}

export interface DailySummary {
  topItems: SummaryItem[]
  criticalCount: number
  coveredCount: number
  avgCoverage: number | null
  sitesWithNeeds: number
  headline: string
}

const PRIORITY_RANK: Record<NeedPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * Resumen derivado EXCLUSIVAMENTE de los datos reales ya cargados.
 * No realiza llamadas externas ni inventa información: solo agrega y ordena
 * las necesidades existentes para destacar lo más urgente del día.
 */
export function buildDailySummary(entities: MapEntity[]): DailySummary {
  const allNeeds = entities.flatMap((e) => e.needs)
  const fresh = allNeeds.filter((n) => getFreshnessLevel(n.updatedAt) !== 'expired')

  const criticalCount = fresh.filter((n) => n.priority === 'critical').length
  const coveredCount = fresh.filter((n) => n.pct >= 90).length
  const avgCoverage = fresh.length
    ? Math.round(fresh.reduce((sum, n) => sum + n.pct, 0) / fresh.length)
    : null

  const sitesWithNeeds = entities.filter((e) => e.needs.length > 0).length

  // Agrega por nombre de insumo sumando el déficit (faltante) y conservando
  // la prioridad más alta reportada.
  const grouped = new Map<string, SummaryItem>()
  for (const need of fresh) {
    if (need.priority !== 'critical' && need.priority !== 'high') continue
    const [received, requiredWithUnit] = need.detail.split('/')
    const requiredNum = parseInt(requiredWithUnit, 10)
    const receivedNum = parseInt(received, 10)
    const unit = requiredWithUnit?.replace(/[0-9.\s]/g, '') || ''
    const deficit =
      Number.isFinite(requiredNum) && Number.isFinite(receivedNum)
        ? Math.max(requiredNum - receivedNum, 0)
        : 0

    const key = need.item.toLowerCase().trim()
    const existing = grouped.get(key)
    if (existing) {
      existing.deficit += deficit
      if (PRIORITY_RANK[need.priority] < PRIORITY_RANK[existing.priority]) {
        existing.priority = need.priority
      }
    } else {
      grouped.set(key, { item: need.item, deficit, unit, priority: need.priority })
    }
  }

  const topItems = [...grouped.values()]
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (p !== 0) return p
      return b.deficit - a.deficit
    })
    .slice(0, 4)

  let headline: string
  if (!fresh.length) {
    headline = 'No hay necesidades activas reportadas en este momento.'
  } else if (topItems.length) {
    const names = topItems.map((i) => i.item).slice(0, 3)
    const list =
      names.length > 1
        ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
        : names[0]
    headline = `Hoy las principales necesidades son ${list}. Hay ${criticalCount} ${
      criticalCount === 1 ? 'necesidad crítica' : 'necesidades críticas'
    } activas en ${sitesWithNeeds} ${sitesWithNeeds === 1 ? 'sitio' : 'sitios'}.`
  } else {
    headline = `Hay ${fresh.length} necesidades activas, ${coveredCount} ya cerca de cubrirse.`
  }

  return {
    topItems,
    criticalCount,
    coveredCount,
    avgCoverage,
    sitesWithNeeds,
    headline,
  }
}
