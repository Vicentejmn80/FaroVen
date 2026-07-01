import type { NeedPriority, Site, SiteNeed } from './types'

type SummarySeverity = 'critical' | 'warning' | 'operational'

export interface PrioritySignal {
  id: string
  title: string
  why: string
  action: string
  severity: SummarySeverity
}

export interface CoveredNeedSignal {
  id: string
  item: string
  coverage: number
  centers: string[]
}

export interface UrgentCenterSignal {
  siteId: string
  name: string
  zone: string
  reason: string
}

export interface SituationSummaryData {
  headline: string
  priorities: PrioritySignal[]
  coveredNeeds: CoveredNeedSignal[]
  urgentCenters: UrgentCenterSignal[]
}

export interface SiteActionPlan {
  now: string[]
  next: string[]
  watch: string[]
}

const PRIORITY_WEIGHT: Record<NeedPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const PRIORITY_LABEL: Record<NeedPriority, string> = {
  critical: 'critica',
  high: 'alta',
  medium: 'media',
  low: 'baja',
}

function scoreNeed(need: SiteNeed) {
  const urgency = Math.max(0, 100 - need.coverage)
  return PRIORITY_WEIGHT[need.priority] * 100 + urgency
}

export function buildSituationSummary(sites: Site[]): SituationSummaryData {
  const flattened = sites.flatMap((site) =>
    site.needs.map((need) => ({
      site,
      need,
      score: scoreNeed(need),
    })),
  )

  const priorities = flattened
    .filter((entry) => entry.need.coverage < 75 || entry.need.priority === 'critical')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => {
      const severity: SummarySeverity =
        entry.need.coverage < 40 || entry.need.priority === 'critical' ? 'critical' : 'warning'

      return {
        id: `${entry.site.id}-${entry.need.id}`,
        title: `${entry.need.item} en ${entry.site.name}`,
        why: `Cobertura ${entry.need.coverage}% con prioridad ${PRIORITY_LABEL[entry.need.priority]}.`,
        action: `Mover apoyo a ${entry.site.zone} en las proximas 2 horas.`,
        severity,
      }
    })

  const grouped = new Map<
    string,
    {
      totalCoverage: number
      samples: number
      centers: string[]
    }
  >()

  for (const site of sites) {
    for (const need of site.needs) {
      const current = grouped.get(need.item) ?? { totalCoverage: 0, samples: 0, centers: [] }
      current.totalCoverage += need.coverage
      current.samples += 1
      if (need.coverage >= 80) current.centers.push(site.name)
      grouped.set(need.item, current)
    }
  }

  const coveredNeeds = [...grouped.entries()]
    .map(([item, data]) => ({
      id: item.toLowerCase().replace(/\s+/g, '-'),
      item,
      coverage: Math.round(data.totalCoverage / Math.max(data.samples, 1)),
      centers: data.centers,
    }))
    .filter((item) => item.coverage >= 80 || item.centers.length >= 1)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 3)

  const urgentCenters = sites
    .map((site) => {
      const criticalNeed = site.needs.find((need) => need.priority === 'critical' && need.coverage < 45)
      if (site.status === 'critical' || criticalNeed) {
        return {
          siteId: site.id,
          name: site.name,
          zone: site.zone,
          reason: criticalNeed
            ? `${criticalNeed.item} por debajo de 45%`
            : `Estado reportado: ${site.statusLabel.toLowerCase()}`,
        }
      }
      return null
    })
    .filter((value): value is UrgentCenterSignal => value !== null)
    .slice(0, 4)

  const headline =
    priorities.length > 0
      ? `${priorities.length} frentes requieren decision inmediata`
      : 'Situacion estable, enfocar seguimiento preventivo'

  return { headline, priorities, coveredNeeds, urgentCenters }
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
