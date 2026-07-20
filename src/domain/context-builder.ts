import type {
  OperationalContext,
  OperationalMetrics,
  OperationalRisk,
  OperationalRecommendation,
  OperationalTimelineEntry,
  RegionalSummary,
  HeatZone,
  ResourceStatus,
  TrendResult,
  DemandAnalysis,
  DecisionInsight,
} from './operational-intelligence.types'

export interface ContextInput {
  metrics: OperationalMetrics
  risk: OperationalRisk
  recommendations: OperationalRecommendation[]
  timeline: OperationalTimelineEntry[]
  heatZones: HeatZone[]
  resources: ResourceStatus[]
  trends: TrendResult[]
  demand: DemandAnalysis
}

export function buildOperationalContext(input: ContextInput): OperationalContext {
  const predictions = generatePredictions(input.trends, input.resources)
  const decisions = generateDecisions(input)

  return {
    currentSituation: input.metrics,
    activeCases: input.metrics.totalCases,
    criticalCenters: input.heatZones.filter((z) => z.classification === 'critical'),
    activeMissions: input.metrics.activeMissions,
    criticalResources: input.resources.filter((r) => r.isCritical),
    recommendedActions: input.recommendations,
    globalRisk: input.risk,
    timeline: input.timeline,
    regionalSummary: buildRegionalSummary(input.heatZones, input.metrics),
    predictions,
    demandAnalysis: input.demand,
    trends: input.trends,
    decisions,
    heatZones: input.heatZones,
    timestamp: new Date(),
  }
}

function buildRegionalSummary(heatZones: HeatZone[], _metrics: OperationalMetrics): RegionalSummary[] {
  return heatZones.map((zone) => ({
    zoneId: zone.id,
    zoneName: zone.name,
    classification: zone.classification,
    caseCount: zone.caseCount,
    missionCount: 0,
    volunteerCount: 0,
    resourcePercentage: zone.resourceScore,
    riskScore: calculateZoneRisk(zone),
  }))
}

function calculateZoneRisk(zone: HeatZone, _metrics?: OperationalMetrics): number {
  let score = 0
  score += zone.caseCount * 5
  score += (100 - zone.resourceScore) * 0.3
  if (zone.classification === 'critical') score += 30
  if (zone.classification === 'hot') score += 15
  if (zone.trend === 'surge') score += 20
  if (zone.trend === 'up') score += 10
  return Math.min(100, Math.round(score))
}

function generatePredictions(trends: TrendResult[], resources: ResourceStatus[]): string[] {
  const predictions: string[] = []

  const resourceTrends = trends.filter((t) => t.metric.toLowerCase().includes('resource'))
  for (const trend of resourceTrends) {
    if (trend.direction === 'down' || trend.direction === 'collapse') {
      predictions.push(`Posible crisis de ${trend.metric} — disminución del ${Math.abs(trend.changePercent)}%`)
    }
  }

  const reportTrend = trends.find((t) => t.metric.toLowerCase().includes('report'))
  if (reportTrend && (reportTrend.direction === 'up' || reportTrend.direction === 'surge')) {
    predictions.push(`Incremento de reportes del ${reportTrend.changePercent}% — probable aumento de casos`)
  }

  const criticalResources = resources.filter((r) => r.isCritical)
  const criticalNames = criticalResources.map((r) => r.type).join(', ')
  if (criticalResources.length >= 2) {
    predictions.push(`Escasez crítica de ${criticalNames} — riesgo operativo alto`)
  }

  return predictions
}

function generateDecisions(input: ContextInput): DecisionInsight[] {
  const insights: DecisionInsight[] = []

  const criticalRecs = input.recommendations.filter((r) => r.priority === 'critical')
  const highRecs = input.recommendations.filter((r) => r.priority === 'high')

  insights.push({
    question: '¿Qué está pasando?',
    answer: describeSituation(input),
    severity: input.risk.level === 'critical' ? 'critical' : input.risk.level === 'high' ? 'warning' : 'info',
    timestamp: new Date(),
  })

  const worsening = input.trends.filter((t) => t.direction === 'up' || t.direction === 'surge')
  if (worsening.length > 0) {
    insights.push({
      question: '¿Qué está empeorando?',
      answer: worsening.map((t) => `${t.metric} (${t.changePercent}%)`).join(', '),
      severity: 'warning',
      timestamp: new Date(),
    })
  }

  const improved = input.trends.filter((t) => t.direction === 'down')
  if (improved.length > 0) {
    insights.push({
      question: '¿Qué mejoró?',
      answer: improved.map((t) => `${t.metric} (${t.changePercent}%)`).join(', '),
      severity: 'info',
      timestamp: new Date(),
    })
  }

  if (criticalRecs.length > 0) {
    insights.push({
      question: '¿Qué requiere atención inmediata?',
      answer: criticalRecs.map((r) => r.action).join(', '),
      severity: 'critical',
      timestamp: new Date(),
    })
  }

  if (input.risk.score > 70) {
    insights.push({
      question: '¿Qué ocurrirá si no hacemos nada?',
      answer: `Riesgo ${input.risk.level} (${input.risk.score}/100). Probable escalada de crisis. ${highRecs.length} acciones recomendadas.`,
      severity: 'critical',
      timestamp: new Date(),
    })
  }

  return insights
}

function describeSituation(input: ContextInput): string {
  const parts: string[] = []
  parts.push(`${input.metrics.totalCases} casos activos (${input.metrics.criticalCases} críticos)`)
  parts.push(`${input.metrics.saturatedCenters} centros saturados`)
  parts.push(`${input.metrics.activeMissions} misiones activas`)
  parts.push(`Riesgo global: ${input.risk.score}/100 (${input.risk.level})`)

  const critical = input.resources.filter((r) => r.isCritical)
  if (critical.length > 0) {
    parts.push(`${critical.length} recursos críticos`)
  }

  return parts.join(' · ')
}
