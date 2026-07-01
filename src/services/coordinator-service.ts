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

export function computeProductSaturation(needs: Need[]): number {
  const active = needs.filter((n) => n.available < n.required)
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
  const activeNeeds = centerNeeds.filter((n) => n.available < n.required)
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

export function eventActorLabel(event: Event): string {
  if (event.kind === 'report') return 'Ciudadano / Coordinador'
  return 'Coordinador del centro'
}

export function eventActionLabel(event: Event): string {
  const title = event.title.toLowerCase()
  if (title.includes('llegada')) return 'Donación recibida'
  if (title.includes('salida')) return 'Salida de inventario'
  if (title.includes('cubierta')) return 'Necesidad cubierta'
  if (title.includes('aprobado')) return 'Reporte aprobado'
  if (title.includes('rechazado')) return 'Reporte rechazado'
  if (event.kind === 'saturation') return 'Saturación actualizada'
  if (event.kind === 'inventory') return 'Inventario actualizado'
  if (event.kind === 'report') return 'Reporte ciudadano'
  return event.title
}
