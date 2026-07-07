import type { Need, NeedPriority, Site } from './types'

type SummarySeverity = 'critical' | 'warning' | 'operational'

export interface PrioritySignal {
  id: string
  resourceName: string
  centerName: string
  priority: NeedPriority
  coveragePct: number
  currentQty: number
  targetQty: number
  missingQty: number
  severity: SummarySeverity
  createdAt: Date
}

export interface ResolvedNeedSignal {
  id: string
  resourceName: string
  centerName: string
  coveragePct: number
  currentQty: number
  targetQty: number
  resolvedAt: Date
}

export interface SituationSummaryData {
  headline: string
  pendingCount: number
  resolvedCount: number
  priorities: PrioritySignal[]
  resolvedHistory: ResolvedNeedSignal[]
}

export interface SiteActionPlan {
  now: string[]
  next: string[]
  watch: string[]
}

function toCoverage(required: number, available: number): number {
  if (required <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((available / required) * 100)))
}

function priorityRank(priority: NeedPriority): number {
  if (priority === 'critical') return 0
  if (priority === 'high') return 1
  if (priority === 'medium') return 2
  return 3
}

function isResolvedNeed(need: Need): boolean {
  if (need.required <= 0) return true
  return need.status === 'covered' || need.status === 'resolved' || (need.required > 0 && need.available >= need.required)
}

export function buildSituationSummary(sites: Site[], needs: Need[] = []): SituationSummaryData {
  const siteById = new Map(sites.map((site) => [site.id, site]))
  const filteredNeeds = needs.filter((need) => siteById.has(need.centerId))

  const unresolved = filteredNeeds.filter((need) => !isResolvedNeed(need))
  const resolved = filteredNeeds.filter((need) => isResolvedNeed(need))

  const priorities = [...unresolved]
    .sort((a, b) => {
      const coverageDiff = toCoverage(a.required, a.available) - toCoverage(b.required, b.available)
      if (coverageDiff !== 0) return coverageDiff

      const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority)
      if (priorityDiff !== 0) return priorityDiff

      return a.updatedAt.getTime() - b.updatedAt.getTime()
    })
    .slice(0, 3)
    .map((need) => {
      const centerName = siteById.get(need.centerId)?.name ?? 'Centro sin nombre'
      const coveragePct = toCoverage(need.required, need.available)
      const missingQty = Math.max(0, need.required - need.available)
      const severity: SummarySeverity = need.priority === 'critical' || coveragePct < 40 ? 'critical' : 'warning'

      return {
        id: need.id,
        resourceName: need.type,
        centerName,
        priority: need.priority,
        coveragePct,
        currentQty: need.available,
        targetQty: need.required,
        missingQty,
        severity,
        createdAt: need.updatedAt,
      }
    })

  const resolvedHistory = [...resolved]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 20)
    .map((need) => ({
      id: need.id,
      resourceName: need.type,
      centerName: siteById.get(need.centerId)?.name ?? 'Centro sin nombre',
      coveragePct: toCoverage(need.required, need.available),
      currentQty: need.available,
      targetQty: need.required,
      resolvedAt: need.updatedAt,
    }))

  const pendingCount = unresolved.length
  const resolvedCount = resolved.length
  const headline = pendingCount > 0 ? `${pendingCount} frentes requieren decision inmediata` : 'Situacion estable'

  return { headline, pendingCount, resolvedCount, priorities, resolvedHistory }
}

export function buildSiteActionPlan(site: Site): SiteActionPlan {
  const criticalNeeds = site.needs.filter((need) => need.priority === 'critical' || need.coverage < 40)
  const constrainedNeeds = site.needs.filter((need) => need.coverage < 70)
  const stableNeeds = site.needs.filter((need) => need.coverage >= 80)

  const now = criticalNeeds.length
    ? criticalNeeds.map(
        (need) => `Asignar recurso para ${need.item} (cobertura ${need.coverage}%) y confirmar recepcion.`,
      )
    : [`Mantener capacidad del centro y validar turnos de respuesta en ${site.zone}.`]

  const next = constrainedNeeds.length
    ? constrainedNeeds
        .slice(0, 3)
        .map((need) => `Programar reabastecimiento de ${need.item} para subir sobre 75%.`)
    : ['Consolidar excedentes y apoyar centros vecinos con mayor presion.']

  const watch = [
    `Monitorear ${site.statusLabel.toLowerCase()} cada 30 minutos.`,
    stableNeeds.length
      ? `Preservar cobertura de ${stableNeeds.map((need) => need.item).join(', ')}.`
      : 'Sin coberturas altas; mantener monitoreo continuo de inventario.',
  ]

  return { now, next, watch }
}
