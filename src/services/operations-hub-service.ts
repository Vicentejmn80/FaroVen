import type { Center, Need, Event, Report } from '@/domain/models'
import { citizenReportPriority } from '@/lib/report-types'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import type { OpsCaseRecord, PipelineTransition, AssignmentSuggestion, OpsSummaryItem } from '@/types/operations-hub.types'
import type { CasePriority as LegacyCasePriority } from '@/types/case.types'

function pipelineStageFromReport(status: string): PipelineStage {
  switch (status) {
    case 'new': return 'nuevo'
    case 'verified': return 'in_attention'
    case 'discarded': return 'archived'
    default: return 'pending_review'
  }
}

export function reportToOpsCase(
  report: Report,
  centers?: Center[],
  _needs?: Need[],
  events?: Event[],
): OpsCaseRecord {
  const stage = pipelineStageFromReport(report.status)
  const centerEvents = (events ?? []).filter(
    (e) => e.reportId === report.id || (report.centerId && e.centerId === report.centerId),
  )
  const timeline: PipelineTransition[] = [
    {
      from: 'nuevo',
      to: stage,
      timestamp: report.createdAt,
      actor: 'Ciudadano',
      reason: 'Reporte creado',
    },
    ...centerEvents.map((e) => ({
      from: stage as PipelineStage,
      to: stage as PipelineStage,
      timestamp: e.createdAt,
      actor: 'Sistema',
      reason: e.title,
    })),
  ]
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const priority = mapPriority(report)

  const matchedCenter = report.centerId
    ? centers?.find((c) => c.id === report.centerId)
    : undefined

  return {
    id: report.id,
    title: report.description.split('.').shift() || 'Reporte ciudadano',
    priority,
    location: report.location?.zone || report.location?.address || 'Zona por confirmar',
    zone: report.location?.zone || '',
    lat: report.location?.coordinates?.lat || report.location?.coordinates?.lng ? report.location.coordinates.lat : undefined,
    lng: report.location?.coordinates?.lng || report.location?.coordinates?.lat ? report.location.coordinates.lng : undefined,
    reportedBy: report.source || 'Ciudadano',
    reportedAt: report.createdAt,
    stage,
    description: report.description,
    contactPhone: '',
    contactEmail: '',
    assignedCenterId: report.centerId,
    assignedTo: matchedCenter?.name,
    category: report.type,
    timeline,
    createdAt: report.createdAt,
    updatedAt: report.createdAt,
  }
}

function mapPriority(report: Report): LegacyCasePriority {
  return citizenReportPriority(report.type)
}

export function sortOpsCases(cases: OpsCaseRecord[]): OpsCaseRecord[] {
  const priorityWeight: Record<string, number> = { high: 4, medium: 2, low: 1 }
  const stageOrder: Record<string, number> = {
    nuevo: 8,
    pending_review: 7,
    validating: 6,
    awaiting_info: 5,
    open_for_applications: 5,
    assigned: 4,
    accepted: 3,
    in_attention: 2,
    resolved: 1,
    archived: 0,
  }

  return [...cases].sort((a, b) => {
    const urgencyA = priorityWeight[a.priority] * stageOrder[a.stage] || 0
    const urgencyB = priorityWeight[b.priority] * stageOrder[b.stage] || 0
    if (urgencyA !== urgencyB) return urgencyB - urgencyA
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}

export function sortCasesByUrgency(cases: CaseDomain[]): CaseDomain[] {
  const priorityWeight: Record<string, number> = { critical: 5, high: 4, medium: 2, low: 1 }
  const stageOrder: Record<string, number> = {
    nuevo: 8,
    pending_review: 7,
    validating: 6,
    awaiting_info: 5,
    open_for_applications: 5,
    assigned: 4,
    accepted: 3,
    in_attention: 2,
    resolved: 1,
    archived: 0,
  }

  return [...cases].sort((a, b) => {
    const urgencyA = priorityWeight[a.priority] * stageOrder[a.pipelineStage] || 0
    const urgencyB = priorityWeight[b.priority] * stageOrder[b.pipelineStage] || 0
    if (urgencyA !== urgencyB) return urgencyB - urgencyA
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}

export function suggestAssignment(
  opsCase: OpsCaseRecord,
  centers: Center[],
  needs: Need[],
): AssignmentSuggestion[] {
  if (!opsCase.lat || !opsCase.lng) return []
  const sorted = centers
    .map((c): AssignmentSuggestion => {
      const dist = haversineDistance(opsCase.lat!, opsCase.lng!, c.location.coordinates.lat, c.location.coordinates.lng)
      const activeNeeds = needs.filter((n) => n.centerId === c.id && n.status !== 'resolved')
      const criticalNeedsCount = activeNeeds.filter((n) => n.priority === 'critical' || (n.required > 0 && n.available / n.required < 0.3)).length
      const saturation: AssignmentSuggestion['saturation'] = criticalNeedsCount > 3 ? 'critical' : criticalNeedsCount > 1 ? 'high' : activeNeeds.length > 0 ? 'medium' : 'low'
      const score = calculateScore(c, dist, saturation, opsCase)
      return {
        centerId: c.id,
        centerName: c.name,
        distance: formatDistance(dist),
        saturation,
        status: c.status,
        score,
      }
    })
    .filter((s) => s.status !== 'critical' || true)
    .sort((a, b) => b.score - a.score)
  return sorted.slice(0, 5)
}

export function suggestCentersForCase(
  caseData: CaseDomain,
  centers: Center[],
  needs: Need[],
): AssignmentSuggestion[] {
  const lat = caseData.location.lat
  const lng = caseData.location.lng
  if (!lat && !lng) return []

  const sorted = centers
    .map((c): AssignmentSuggestion => {
      const dist = haversineDistance(lat, lng, c.location.coordinates.lat, c.location.coordinates.lng)
      const activeNeeds = needs.filter((n) => n.centerId === c.id && n.status !== 'resolved')
      const criticalNeedsCount = activeNeeds.filter((n) => n.priority === 'critical' || (n.required > 0 && n.available / n.required < 0.3)).length
      const saturation: AssignmentSuggestion['saturation'] = criticalNeedsCount > 3 ? 'critical' : criticalNeedsCount > 1 ? 'high' : activeNeeds.length > 0 ? 'medium' : 'low'
      return {
        centerId: c.id,
        centerName: c.name,
        distance: formatDistance(dist),
        saturation,
        status: c.status,
        score: calculateScore(c, dist, saturation, null),
      }
    })
    .filter((s) => s.status !== 'critical' || true)
    .sort((a, b) => b.score - a.score)
  return sorted.slice(0, 5)
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
  const label = km < 1 ? 'Muy cercano' : km < 3 ? 'Cercano' : km < 8 ? 'Moderado' : 'Lejano'
  return `${label} (${km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`})`
}

function calculateScore(
  center: Center,
  distance: number,
  saturation: string,
  _opsCase: OpsCaseRecord | null,
): number {
  let score = 50
  score -= distance * 2
  if (saturation === 'critical') score -= 30
  if (saturation === 'high') score -= 15
  if (center.status === 'operational') score += 20
  if (center.status === 'warning') score -= 5
  if (center.status === 'critical') score -= 40
  return Math.max(0, Math.min(100, score))
}

export function computeSummaryMetrics(
  cases: OpsCaseRecord[],
  centers: Center[],
): OpsSummaryItem[] {
  const critical = cases.filter((c) => c.priority === 'high' && c.stage !== 'resolved' && c.stage !== 'archived').length
  const newCases = cases.filter((c) => c.stage === 'nuevo' || c.stage === 'pending_review').length
  const inReview = cases.filter((c) => c.stage === 'validating' || c.stage === 'awaiting_info').length
  const inAttention = cases.filter((c) => c.stage === 'assigned' || c.stage === 'accepted' || c.stage === 'in_attention').length
  const saturated = centers.filter((c) => c.status === 'critical').length
  const available = centers.filter((c) => c.status === 'operational').length

  const responseTimes = cases
    .filter((c) => c.timeline.length > 1)
    .map((c) => {
      const first = c.timeline[0]
      const last = c.timeline[c.timeline.length - 1]
      return last.timestamp.getTime() - first.timestamp.getTime()
    })
  const avgMs = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0
  const avgMin = Math.round(avgMs / 60000)

  return [
    { id: 'critical', label: 'Críticos', value: critical, tone: 'critical' },
    { id: 'new', label: 'Nuevos', value: newCases, tone: 'info' },
    { id: 'in_review', label: 'En revisión', value: inReview, tone: 'warning' },
    { id: 'in_attention', label: 'En atención', value: inAttention, tone: 'operational' },
    { id: 'avg_response', label: 'Tiempo promedio', value: avgMin > 0 ? `${avgMin} min` : '\u2014', tone: 'neutral' },
    { id: 'centers_saturated', label: 'Centros saturados', value: saturated, tone: 'critical' },
    { id: 'centers_available', label: 'Centros disponibles', value: available, tone: 'operational' },
  ] as OpsSummaryItem[]
}

export function computeCaseSummary(
  cases: CaseDomain[],
  centers: Center[],
): OpsSummaryItem[] {
  const active = cases.filter(
    (c) => c.pipelineStage !== 'resolved' && c.pipelineStage !== 'archived',
  )
  const critical = active.filter(
    (c) => c.priority === 'critical' || c.priority === 'high',
  ).length
  const unassigned = active.filter(
    (c) =>
      !c.assignedCenterId &&
      !c.assignedTo &&
      c.pipelineStage !== 'in_attention',
  ).length

  const responseSamples = cases
    .map((c) => {
      if (c.firstResponseAt) {
        return c.firstResponseAt.getTime() - c.createdAt.getTime()
      }
      if (c.assignedAt) {
        return c.assignedAt.getTime() - c.createdAt.getTime()
      }
      return null
    })
    .filter((v): v is number => v !== null && v >= 0)

  const avgMs =
    responseSamples.length > 0
      ? responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length
      : 0
  const avgMin = Math.round(avgMs / 60000)
  const avgLabel =
    avgMin <= 0
      ? '—'
      : avgMin < 60
        ? `${avgMin} min`
        : `${(avgMin / 60).toFixed(1)} h`

  void centers

  return [
    { id: 'active', label: 'Casos activos', value: active.length, tone: 'info' },
    {
      id: 'critical',
      label: 'Casos críticos',
      value: critical,
      tone: critical > 0 ? 'critical' : 'neutral',
    },
    { id: 'avg_response', label: 'Tiempo resp. promedio', value: avgLabel, tone: 'neutral' },
    {
      id: 'unassigned',
      label: 'Sin asignar',
      value: unassigned,
      tone: unassigned > 0 ? 'warning' : 'operational',
    },
  ]
}
