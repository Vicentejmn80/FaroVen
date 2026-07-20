import { describe, it, expect } from 'vitest'
import { buildOperationalContext, type ContextInput } from '../context-builder'
import { ZONE_CLASSIFICATIONS, TREND_DIRECTIONS, RESOURCE_TYPES, RECOMMENDATION_PRIORITIES, RECOMMENDATION_CATEGORIES } from '../operational-intelligence.types'

function baseInput(overrides?: Partial<ContextInput>): ContextInput {
  return {
    metrics: {
      totalCases: 30,
      criticalCases: 3,
      saturatedCenters: 1,
      operationalCenters: 8,
      offlineCenters: 0,
      activeVolunteers: 20,
      availableVolunteers: 10,
      activeMissions: 5,
      criticalMissions: 1,
      avgAttentionMinutes: 25,
      avgArrivalMinutes: 18,
      breachedSlaCount: 2,
      totalReports: 80,
      pendingReports: 15,
    },
    risk: {
      score: 30,
      level: 'medium',
      factors: [],
      timestamp: new Date(),
    },
    recommendations: [],
    timeline: [],
    heatZones: [],
    resources: [],
    trends: [],
    demand: {
      mostNeededResources: [],
      mostNeededSkills: [],
      worseningZones: [],
      centersNeedingSupport: [],
    },
    ...overrides,
  }
}

describe('buildOperationalContext', () => {
  it('construye contexto operacional completo', () => {
    const context = buildOperationalContext(baseInput())
    expect(context.currentSituation).toBeDefined()
    expect(context.globalRisk).toBeDefined()
    expect(context.recommendedActions).toEqual([])
    expect(context.timeline).toEqual([])
    expect(context.regionalSummary).toEqual([])
    expect(context.predictions).toEqual([])
    expect(context.decisions).toBeDefined()
    expect(context.timestamp).toBeDefined()
  })

  it('identifica centros críticos', () => {
    const context = buildOperationalContext(baseInput({
      heatZones: [{
        id: 'z-1',
        name: 'Zona Crítica',
        classification: ZONE_CLASSIFICATIONS.CRITICAL,
        center: { lat: 10.5, lng: -66.9 },
        radius: 5,
        caseCount: 50,
        reportCount: 100,
        resourceScore: 15,
        trend: TREND_DIRECTIONS.UP,
        lastUpdated: new Date(),
      }],
    }))
    expect(context.criticalCenters).toHaveLength(1)
    expect(context.criticalCenters[0].name).toBe('Zona Crítica')
  })

  it('identifica recursos críticos', () => {
    const context = buildOperationalContext(baseInput({
      resources: [{
        type: RESOURCE_TYPES.WATER,
        current: 10,
        capacity: 100,
        percentage: 10,
        isCritical: true,
        centers: [],
      }],
    }))
    expect(context.criticalResources).toHaveLength(1)
    expect(context.criticalResources[0].type).toBe(RESOURCE_TYPES.WATER)
  })

  it('genera regional summary desde heat zones', () => {
    const context = buildOperationalContext(baseInput({
      heatZones: [{
        id: 'z-1',
        name: 'Zona Norte',
        classification: ZONE_CLASSIFICATIONS.HOT,
        center: { lat: 10.5, lng: -66.9 },
        radius: 5,
        caseCount: 20,
        reportCount: 40,
        resourceScore: 50,
        trend: TREND_DIRECTIONS.UP,
        lastUpdated: new Date(),
      }],
    }))
    expect(context.regionalSummary).toHaveLength(1)
    expect(context.regionalSummary[0].zoneName).toBe('Zona Norte')
    expect(context.regionalSummary[0].classification).toBe(ZONE_CLASSIFICATIONS.HOT)
  })

  it('genera predicciones desde trends y recursos', () => {
    const context = buildOperationalContext(baseInput({
      resources: [{
        type: RESOURCE_TYPES.WATER,
        current: 5,
        capacity: 100,
        percentage: 5,
        isCritical: true,
        centers: [],
      }, {
        type: RESOURCE_TYPES.MEDICINE,
        current: 10,
        capacity: 100,
        percentage: 10,
        isCritical: true,
        centers: [],
      }],
      trends: [{
        metric: 'resource_water',
        direction: TREND_DIRECTIONS.DOWN,
        currentValue: 10,
        previousValue: 50,
        changePercent: -80,
        points: [],
        isAlert: false,
      }, {
        metric: 'reportes',
        direction: TREND_DIRECTIONS.UP,
        currentValue: 100,
        previousValue: 50,
        changePercent: 100,
        points: [],
        isAlert: true,
        alertMessage: 'Aumento significativo',
      }],
    }))
    expect(context.predictions.length).toBeGreaterThanOrEqual(1)
    expect(context.predictions.some((p) => p.includes('crisis'))).toBe(true)
  })

  it('genera decisiones informativas', () => {
    const context = buildOperationalContext(baseInput())
    expect(context.decisions.length).toBeGreaterThanOrEqual(1)
    const whatNow = context.decisions.find((d) => d.question === '¿Qué está pasando?')
    expect(whatNow).toBeDefined()
    expect(whatNow!.answer).toContain('30 casos activos')
  })

  it('genera alerta de empeoramiento si hay tendencias al alza', () => {
    const context = buildOperationalContext(baseInput({
      trends: [{
        metric: 'casos',
        direction: TREND_DIRECTIONS.UP,
        currentValue: 80,
        previousValue: 50,
        changePercent: 60,
        points: [],
        isAlert: false,
      }],
    }))
    const worsening = context.decisions.find((d) => d.question === '¿Qué está empeorando?')
    expect(worsening).toBeDefined()
    expect(worsening!.answer).toContain('casos')
  })

  it('incluye advertencia si riesgo > 70', () => {
    const context = buildOperationalContext(baseInput({
      risk: {
        score: 85,
        level: 'critical',
        factors: [],
        timestamp: new Date(),
      },
    }))
    const inaction = context.decisions.find((d) => d.question === '¿Qué ocurrirá si no hacemos nada?')
    expect(inaction).toBeDefined()
    expect(inaction!.answer).toContain('Riesgo')
  })

  it('incluye recomendaciones en el contexto', () => {
    const context = buildOperationalContext(baseInput({
      recommendations: [{
        id: 'rec-1',
        category: RECOMMENDATION_CATEGORIES.VOLUNTEER,
        action: 'Activar voluntarios',
        description: 'Se necesitan más voluntarios',
        reason: 'Disponibles insuficientes',
        expectedImpact: 'Mejorar capacidad de respuesta',
        priority: RECOMMENDATION_PRIORITIES.CRITICAL,
        confidence: 85,
        createdAt: new Date(),
      }],
    }))
    expect(context.recommendedActions).toHaveLength(1)
    expect(context.recommendedActions[0].action).toBe('Activar voluntarios')
  })

  it('timestamp es generado', () => {
    const before = new Date()
    const context = buildOperationalContext(baseInput())
    expect(context.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })
})
