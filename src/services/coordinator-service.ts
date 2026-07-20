import type { Center, Event, Need, Report } from '@/domain/models'
import type { RegisterSiteType } from '@/repositories/types'
import type { Site } from '@/lib/types'
import { siteToNeedableType } from '@/lib/site-utils'

export type CoordinatorModuleId =
  | 'dashboard'
  | 'needs'
  | 'donations'
  | 'saturation'
  | 'reports'
  | 'history'
  | 'cases'
  | 'center-ops'
  | 'missions'

export type InboxFilter = 'pending' | 'approved' | 'rejected' | 'all'

export interface CoordinatorDashboardMetrics {
  siteName: string
  siteType: RegisterSiteType
  siteTypeLabel: string
  operationalStatus: string
  lastUpdated: Date
  activeNeedsCount: number
  pendingReportsCount: number
  peopleSaturationPct: number
  productSaturationPct: number
}

function needCoverage(need: Need): number {
  return Math.round((need.available / Math.max(need.required, 1)) * 100)
}

function isActiveNeed(need: Need): boolean {
  return need.status !== 'pending_closure' && need.status !== 'resolved'
}

export function computeProductSaturation(needs: Need[]): number {
  const active = needs.filter((n) => isActiveNeed(n) && n.available < n.required)
  if (!active.length) return 100
  const avg =
    active.reduce((sum, need) => sum + needCoverage(need), 0) / active.length
  return Math.round(avg)
}

export function computePeopleSaturation(center: Center | undefined): number {
  if (!center) return 0
  const { current, total } = center.capacity
  if (!total) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

export function siteTypeLabel(type: RegisterSiteType): string {
  if (type === 'hospital') return 'Hospital'
  if (type === 'shelter') return 'Refugio'
  return 'Centro de acopio'
}

export function reportInboxFilter(report: Report, filter: InboxFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'pending') return report.status === 'new'
  if (filter === 'approved') return report.status === 'verified'
  return report.status === 'discarded'
}

export function buildCoordinatorDashboard(
  site: Site,
  center: Center | undefined,
  needs: Need[],
  reports: Report[],
): CoordinatorDashboardMetrics {
  const siteType = siteToNeedableType(site)
  const centerNeeds = needs.filter((n) => n.centerId === site.id)
  const activeNeeds = centerNeeds.filter((n) => isActiveNeed(n) && n.available < n.required)
  const pendingReports = reports.filter(
    (r) => r.centerId === site.id && r.status === 'new',
  )

  return {
    siteName: site.name,
    siteType,
    siteTypeLabel: siteTypeLabel(siteType),
    operationalStatus: site.statusLabel,
    lastUpdated: site.updatedAt,
    activeNeedsCount: activeNeeds.length,
    pendingReportsCount: pendingReports.length,
    peopleSaturationPct: computePeopleSaturation(center),
    productSaturationPct: computeProductSaturation(centerNeeds),
  }
}

export function filterCenterEvents(events: Event[], siteId: string): Event[] {
  return events.filter((e) => e.centerId === siteId)
}

/** Historial operativo del centro: hitos, no micro-updates. */
export function filterCenterHistoryEvents(events: Event[], siteId: string): Event[] {
  const HIGH_VALUE = new Set([
    'need_created',
    'need_resolved',
    'need_reopened',
    'cycle_closed',
    'inventory_complete',
    'coordinator_approved',
    'center_opened',
    'report',
    'resolved',
    'request',
  ])
  return events
    .filter((e) => e.centerId === siteId)
    .filter((e) => {
      if (HIGH_VALUE.has(e.kind)) return true
      if (e.kind === 'saturation') {
        return e.title.includes('cambió de estado') || e.title.includes('Nivel de saturación')
      }
      return false
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function eventActorLabel(event: Event): string {
  if (event.kind === 'report') return 'Ciudadano'
  if (event.kind === 'coordinator_approved') return 'Administración'
  if (event.kind === 'center_opened') return 'Sistema'
  return 'Coordinador del centro'
}

export function eventActionLabel(event: Event): string {
  switch (event.kind) {
    case 'need_created':
      return 'Necesidad creada'
    case 'need_resolved':
    case 'resolved':
      return 'Necesidad resuelta'
    case 'need_reopened':
      return 'Necesidad reabierta'
    case 'cycle_closed':
      return 'Ciclo operativo cerrado'
    case 'inventory_complete':
      return 'Inventario completado'
    case 'coordinator_approved':
      return 'Coordinador aprobado'
    case 'center_opened':
      return 'Centro registrado'
    case 'report':
      return event.title.includes('aprobado')
        ? 'Reporte aprobado'
        : event.title.includes('rechazado')
          ? 'Reporte rechazado'
          : 'Reporte ciudadano'
    case 'saturation':
      return 'Estado del centro'
    case 'request':
      return 'Necesidad crítica'
    default:
      return event.title
  }
}
