import type {
  OperationalRecommendation,
  ResourceStatus,
  OperationalMetrics,
  HeatZone,
  DemandAnalysis,
} from './operational-intelligence.types'
import {
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_CATEGORIES,
  RESOURCE_CRITICAL_THRESHOLD,
} from './operational-intelligence.types'

export interface RecommendationInput {
  metrics: OperationalMetrics
  resources: ResourceStatus[]
  heatZones: HeatZone[]
  demand: DemandAnalysis
  availableVolunteers: number
  activeMissions: number
  breachedSlaCount: number
}

export function generateRecommendations(input: RecommendationInput): OperationalRecommendation[] {
  const recommendations: OperationalRecommendation[] = []

  recommendations.push(...recommendResources(input.resources))
  recommendations.push(...recommendVolunteers(input.metrics, input.availableVolunteers, input.demand))
  recommendations.push(...recommendCenters(input.heatZones, input.resources))
  recommendations.push(...recommendEscalation(input.metrics, input.breachedSlaCount))
  recommendations.push(...recommendEvacuation(input.heatZones))

  return recommendations.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.priority] - order[b.priority]
  })
}

function recommendResources(resources: ResourceStatus[]): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = []
  const criticalResources = resources.filter((r) => r.isCritical)

  for (const res of criticalResources) {
    const bestCenter = res.centers.sort((a, b) => b.percentage - a.percentage)[0]
    const worstCenter = res.centers.sort((a, b) => a.percentage - b.percentage)[0]

    if (bestCenter && worstCenter && bestCenter.id !== worstCenter.id) {
      recs.push({
        id: crypto.randomUUID(),
        category: RECOMMENDATION_CATEGORIES.RESOURCE,
        action: `Redistribuir ${res.type}`,
        description: `Mover ${res.type} desde ${bestCenter.name} hacia ${worstCenter.name}`,
        reason: `${worstCenter.name} tiene solo ${worstCenter.percentage}% de ${res.type}`,
        expectedImpact: `Estabilizar suministro de ${res.type} en zona crítica`,
        priority: RECOMMENDATION_PRIORITIES.CRITICAL,
        confidence: 85,
        resourceType: res.type,
        createdAt: new Date(),
      })
    }

    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.RESOURCE,
      action: `Solicitar ${res.type}`,
      description: `Se requiere envío urgente de ${res.type} a centros con nivel crítico`,
      reason: `Nivel actual: ${res.percentage}% — umbral crítico: ${RESOURCE_CRITICAL_THRESHOLD}%`,
      expectedImpact: `Evitar desabastecimiento total de ${res.type}`,
      priority: RECOMMENDATION_PRIORITIES.CRITICAL,
      confidence: 90,
      resourceType: res.type,
      createdAt: new Date(),
    })
  }

  return recs
}

function recommendVolunteers(
  metrics: OperationalMetrics,
  available: number,
  demand: DemandAnalysis,
): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = []

  if (available === 0 && metrics.activeMissions > 0) {
    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.VOLUNTEER,
      action: 'Activar voluntarios de reserva',
      description: 'No hay voluntarios disponibles y hay misiones activas',
      reason: 'Disponibles: 0 — Misiones activas: ' + metrics.activeMissions,
      expectedImpact: 'Garantizar continuidad operativa',
      priority: RECOMMENDATION_PRIORITIES.CRITICAL,
      confidence: 95,
      createdAt: new Date(),
    })
  }

  if (available < 5 && metrics.activeMissions > 3) {
    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.VOLUNTEER,
      action: 'Solicitar más voluntarios',
      description: `Solo ${available} voluntarios disponibles para ${metrics.activeMissions} misiones activas`,
      reason: 'Ratio disponible/misión insuficiente',
      expectedImpact: 'Reducir tiempo de respuesta en nuevas misiones',
      priority: RECOMMENDATION_PRIORITIES.HIGH,
      confidence: 80,
      createdAt: new Date(),
    })
  }

  if (demand.mostNeededSkills.length > 0) {
    for (const skill of demand.mostNeededSkills.slice(0, 2)) {
      if (skill.count > 3) {
        recs.push({
          id: crypto.randomUUID(),
          category: RECOMMENDATION_CATEGORIES.VOLUNTEER,
          action: `Convocar voluntarios con skill: ${skill.label}`,
          description: `Se necesitan ${skill.count} voluntarios con habilidad "${skill.label}"`,
          reason: 'Demanda identificada en análisis de misiones y casos',
          expectedImpact: `Cubrir brecha de ${skill.label} en operaciones`,
          priority: RECOMMENDATION_PRIORITIES.HIGH,
          confidence: 75,
          createdAt: new Date(),
        })
      }
    }
  }

  return recs
}

function recommendCenters(heatZones: HeatZone[], resources: ResourceStatus[]): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = []
  const criticalZones = heatZones.filter((z) => z.classification === 'critical')
  const hotZones = heatZones.filter((z) => z.classification === 'hot')

  if (criticalZones.length > 0) {
    for (const zone of criticalZones) {
      recs.push({
        id: crypto.randomUUID(),
        category: RECOMMENDATION_CATEGORIES.CENTER,
        action: `Reforzar zona: ${zone.name}`,
        description: `La zona ${zone.name} está clasificada como crítica con ${zone.caseCount} casos`,
        reason: `Tendencia: ${zone.trend} — Puntaje de recursos: ${zone.resourceScore}`,
        expectedImpact: 'Reducir presión sobre centros en la zona',
        priority: RECOMMENDATION_PRIORITIES.CRITICAL,
        confidence: 85,
        createdAt: new Date(),
      })
    }
  }

  if (hotZones.length > 2) {
    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.CENTER,
      action: 'Abrir refugio temporal',
      description: `${hotZones.length} zonas calientes detectadas — capacidad de refugio podría ser insuficiente`,
      reason: 'Múltiples zonas con alta concentración de casos',
      expectedImpact: 'Descongestionar centros existentes',
      priority: RECOMMENDATION_PRIORITIES.HIGH,
      confidence: 70,
      createdAt: new Date(),
    })
  }

  const lowResources = resources.filter((r) => r.isCritical)
  if (lowResources.length >= 3) {
    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.LOGISTICS,
      action: 'Reevaluar cadena de suministro',
      description: `${lowResources.length} tipos de recursos en nivel crítico`,
      reason: 'Múltiples recursos por debajo del umbral',
      expectedImpact: 'Prevenir colapso logístico',
      priority: RECOMMENDATION_PRIORITIES.CRITICAL,
      confidence: 80,
      createdAt: new Date(),
    })
  }

  return recs
}

function recommendEscalation(
  metrics: OperationalMetrics,
  breachedSlaCount: number,
): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = []

  if (breachedSlaCount > 10) {
    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.ESCALATION,
      action: 'Escalar al Operations Hub',
      description: `${breachedSlaCount} SLAs incumplidos — la operación requiere atención del Operations Hub`,
      reason: 'Alto volumen de incumplimiento de SLA',
      expectedImpact: 'Reasignar prioridades y recursos',
      priority: RECOMMENDATION_PRIORITIES.HIGH,
      confidence: 90,
      createdAt: new Date(),
    })
  }

  if (metrics.criticalCases > metrics.totalCases * 0.3) {
    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.ESCALATION,
      action: 'Solicitar apoyo externo',
      description: `El ${Math.round((metrics.criticalCases / Math.max(metrics.totalCases, 1)) * 100)}% de los casos son críticos`,
      reason: 'Proporción de casos críticos supera el 30%',
      expectedImpact: 'Reforzar capacidad de respuesta',
      priority: RECOMMENDATION_PRIORITIES.CRITICAL,
      confidence: 85,
      createdAt: new Date(),
    })
  }

  return recs
}

function recommendEvacuation(heatZones: HeatZone[]): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = []
  const criticalZones = heatZones.filter((z) => z.classification === 'critical' && z.trend === 'surge')

  for (const zone of criticalZones) {
    recs.push({
      id: crypto.randomUUID(),
      category: RECOMMENDATION_CATEGORIES.EVACUATION,
      action: `Evaluar evacuación en ${zone.name}`,
      description: `Zona ${zone.name} crítica con tendencia de escalada — ${zone.caseCount} casos activos`,
      reason: 'Clasificación crítica + tendencia al alza acelerada',
      expectedImpact: 'Proteger a ciudadanos en zona de alto riesgo',
      priority: RECOMMENDATION_PRIORITIES.CRITICAL,
      confidence: 75,
      location: zone.name,
      createdAt: new Date(),
    })
  }

  return recs
}
