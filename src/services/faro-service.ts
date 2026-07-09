import type { ActivityEvent, BlufMetric, Center, Event, Need, Report, Site, SiteNeed } from '@/lib/types'
import { GUIDE_LIBRARY } from '@/data/guide-library'
import { SUMMARY_LABELS } from '@/lib/summary-labels'
import { isValidCoord, parseCoord } from '@/lib/utils'

export interface FaroDataset {
  centers: Center[]
  needs: Need[]
  reports: Report[]
  events: Event[]
}

export const EMPTY_FARO_DATASET: FaroDataset = {
  centers: [],
  needs: [],
  reports: [],
  events: [],
}

function coverage(need: Need): number {
  return Math.max(0, Math.min(100, Math.round((need.available / Math.max(need.required, 1)) * 100)))
}

function isActiveNeed(need: Need): boolean {
  if (need.status === 'pending_closure' || need.status === 'resolved') return false
  return true
}

function toSiteNeed(need: Need): SiteNeed {
  return {
    id: need.id,
    item: need.type,
    priority: need.priority,
    coverage: coverage(need),
  }
}

function statusLabel(center: Center): string {
  if (center.type === 'hospital' || center.type === 'shelter' || center.type === 'medical_center') {
    return `Saturación ${Math.round((center.capacity.current / Math.max(center.capacity.total, 1)) * 100)}%`
  }
  if (center.type === 'supply_center') return center.status === 'operational' ? 'Operativo · recibe' : 'Capacidad media'
  return 'Monitoreo activo'
}

function fallbackMapPoint(index: number) {
  const points = [
    { x: 0.36, y: 0.3 },
    { x: 0.55, y: 0.46 },
    { x: 0.7, y: 0.36 },
    { x: 0.2, y: 0.52 },
    { x: 0.42, y: 0.62 },
  ]
  return points[index % points.length]
}

export function toSite(center: Center, needsByCenter: Map<string, Need[]>, index: number): Site {
  const point = fallbackMapPoint(index)
  const lat = parseCoord(center.location.coordinates.lat)
  const lng = parseCoord(center.location.coordinates.lng)
  return {
    id: center.id,
    name: center.name,
    type: center.type,
    status: center.status,
    statusLabel: statusLabel(center),
    zone: center.location.zone,
    lat: isValidCoord(lat, lng) ? lat : NaN,
    lng: isValidCoord(lat, lng) ? lng : NaN,
    mapX: point.x,
    mapY: point.y,
    needs: (needsByCenter.get(center.id) ?? []).map(toSiteNeed),
    updatedAt: center.updatedAt,
    verified: center.confidence !== 'low',
  }
}

function summarizeNeedEvent(need: Need, center: Center): Event | null {
  if (!isActiveNeed(need)) return null
  const pct = coverage(need)
  if (need.priority === 'critical' && pct < 45) {
    return {
      id: `evt-need-${need.id}`,
      kind: 'request',
      title: `Nueva necesidad crítica`,
      detail: `${need.type} · ${center.name}`,
      centerId: center.id,
      status: 'critical',
      createdAt: need.updatedAt,
    }
  }
  if (need.status === 'resolved' || pct >= 100) {
    return {
      id: `evt-covered-${need.id}`,
      kind: 'resolved',
      title: `Necesidad resuelta`,
      detail: `${need.type} · ${center.name}`,
      centerId: center.id,
      status: 'operational',
      createdAt: need.updatedAt,
    }
  }
  return null
}

function reportToEvent(report: Report, centerName?: string): Event {
  return {
    id: `evt-report-${report.id}`,
    kind: 'report',
    title: centerName ? `Reporte verificado en ${centerName}` : 'Nuevo reporte ciudadano verificado',
    detail: report.description,
    centerId: report.centerId,
    reportId: report.id,
    status: report.status === 'verified' ? 'info' : 'warning',
    createdAt: report.createdAt,
  }
}

export function buildTimelineEvents(
  dataset: FaroDataset = EMPTY_FARO_DATASET,
  options?: { authoritativeEvents?: boolean },
): Event[] {
  if (options?.authoritativeEvents && dataset.events.length) {
    return [...dataset.events]
      .filter(isHighValueEvent)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  const centerById = new Map(dataset.centers.map((center) => [center.id, center]))

  // Fallback sintético: solo hitos (necesidades críticas/resueltas + reportes). Sin micro-updates de centro.
  const generatedFromNeeds = dataset.needs
    .map((need) => {
      const center = centerById.get(need.centerId)
      return center ? summarizeNeedEvent(need, center) : null
    })
    .filter((event): event is Event => event !== null)
  const generatedFromReports = dataset.reports
    .filter((report) => report.status === 'new' || report.status === 'verified')
    .map((report) =>
      reportToEvent(report, report.centerId ? centerById.get(report.centerId)?.name : undefined),
    )

  return [...generatedFromNeeds, ...generatedFromReports].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}

export function getSites(dataset: FaroDataset = EMPTY_FARO_DATASET): Site[] {
  const needsByCenter = new Map<string, Need[]>()
  for (const need of dataset.needs) {
    if (!isActiveNeed(need)) continue
    const list = needsByCenter.get(need.centerId) ?? []
    list.push(need)
    needsByCenter.set(need.centerId, list)
  }
  return dataset.centers.map((center, index) => toSite(center, needsByCenter, index))
}

export function getCenterById(id: string, dataset: FaroDataset = EMPTY_FARO_DATASET): Center | undefined {
  return dataset.centers.find((center) => center.id === id)
}

export function getCriticalCenters(dataset: FaroDataset = EMPTY_FARO_DATASET): Center[] {
  return dataset.centers.filter((center) => center.status === 'critical' || center.priority === 'critical')
}

export function getReportsByCenter(centerId: string, dataset: FaroDataset = EMPTY_FARO_DATASET): Report[] {
  return dataset.reports
    .filter((report) => report.centerId === centerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getCriticalNeeds(dataset: FaroDataset = EMPTY_FARO_DATASET): Need[] {
  return dataset.needs.filter(
    (need) => isActiveNeed(need) && (need.priority === 'critical' || coverage(need) < 40),
  )
}

export function getLatestActivity(limit = 8, dataset: FaroDataset = EMPTY_FARO_DATASET): Event[] {
  return buildTimelineEvents(dataset, { authoritativeEvents: dataset.events.length > 0 }).slice(0, limit)
}

const HIGH_VALUE_KINDS = new Set([
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

/** Filtra ruido legado (Actualización de inventario, etc.). */
export function isHighValueEvent(event: Event): boolean {
  if (HIGH_VALUE_KINDS.has(event.kind)) return true
  if (event.kind === 'saturation') {
    return (
      event.title.includes('cambió de estado') ||
      event.title.includes('Nivel de saturación') ||
      event.title.includes('registrado')
    )
  }
  if (event.kind === 'inventory') {
    return (
      event.title.includes('Nueva necesidad') ||
      event.title.includes('cubierta') ||
      event.title.includes('completado')
    )
  }
  return false
}

function mapActivityKind(kind: Event['kind']): ActivityEvent['kind'] {
  switch (kind) {
    case 'need_created':
    case 'need_resolved':
    case 'need_reopened':
    case 'cycle_closed':
    case 'inventory_complete':
    case 'coordinator_approved':
    case 'center_opened':
    case 'inventory':
    case 'saturation':
    case 'report':
    case 'request':
    case 'resolved':
      return kind
    default:
      return 'report'
  }
}

export function toActivityEvent(event: Event, siteName?: string): ActivityEvent {
  return {
    id: event.id,
    kind: mapActivityKind(event.kind),
    title: event.title,
    detail: event.detail,
    siteName,
    status: event.status,
    at: event.createdAt,
  }
}

export function getActivityFeed(limit = 8, dataset: FaroDataset = EMPTY_FARO_DATASET): ActivityEvent[] {
  const centerById = new Map(dataset.centers.map((center) => [center.id, center.name]))
  return getLatestActivity(limit, dataset).map((event) => toActivityEvent(event, event.centerId ? centerById.get(event.centerId) : undefined))
}

export function getTimelineByCenter(centerId: string, dataset: FaroDataset = EMPTY_FARO_DATASET): Event[] {
  return buildTimelineEvents(dataset, { authoritativeEvents: dataset.events.length > 0 }).filter(
    (event) => event.centerId === centerId,
  )
}

export function getSummary(dataset: FaroDataset = EMPTY_FARO_DATASET): BlufMetric[] {
  const timeline = buildTimelineEvents(dataset, { authoritativeEvents: dataset.events.length > 0 })
  const criticalCenters = getCriticalCenters(dataset).length
  const criticalNeeds = getCriticalNeeds(dataset).length
  const operationalCenters = dataset.centers.filter((center) => center.status === 'operational').length
  const recentUpdates = timeline.filter((event) => Date.now() - event.createdAt.getTime() < 24 * 60 * 60 * 1000).length

  return [
    { id: 'sm-1', label: SUMMARY_LABELS.criticalCenters, value: criticalCenters, status: 'critical', trend: 'up' },
    { id: 'sm-2', label: SUMMARY_LABELS.criticalNeeds, value: criticalNeeds, status: 'warning', trend: 'down' },
    {
      id: 'sm-3',
      label: SUMMARY_LABELS.operationalCenters,
      value: operationalCenters,
      status: 'operational',
      trend: 'flat',
    },
    {
      id: 'sm-4',
      label: SUMMARY_LABELS.recentUpdates,
      value: recentUpdates,
      unit: '24 h',
      status: 'info',
      trend: 'up',
    },
  ]
}

export function getGuideLibrary() {
  return GUIDE_LIBRARY
}
