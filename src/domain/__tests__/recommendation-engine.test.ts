import { describe, it, expect } from 'vitest'
import { generateRecommendations, type RecommendationInput } from '../recommendation-engine'
import { RESOURCE_TYPES, RECOMMENDATION_CATEGORIES, ZONE_CLASSIFICATIONS, TREND_DIRECTIONS } from '../operational-intelligence.types'

function baseInput(overrides?: Partial<RecommendationInput>): RecommendationInput {
  return {
    metrics: {
      totalCases: 20,
      criticalCases: 2,
      saturatedCenters: 1,
      operationalCenters: 5,
      offlineCenters: 0,
      activeVolunteers: 15,
      availableVolunteers: 8,
      activeMissions: 6,
      criticalMissions: 1,
      avgAttentionMinutes: 20,
      avgArrivalMinutes: 15,
      breachedSlaCount: 0,
      totalReports: 50,
      pendingReports: 10,
    },
    resources: [],
    heatZones: [],
    demand: {
      mostNeededResources: [],
      mostNeededSkills: [],
      worseningZones: [],
      centersNeedingSupport: [],
    },
    availableVolunteers: 8,
    activeMissions: 6,
    breachedSlaCount: 0,
    ...overrides,
  }
}

describe('generateRecommendations', () => {
  it('retorna array vacío con parámetros normales', () => {
    const recs = generateRecommendations(baseInput())
    expect(Array.isArray(recs)).toBe(true)
  })

  it('recomienda recursos críticos cuando hay recursos bajo threshold', () => {
    const recs = generateRecommendations(baseInput({
      resources: [{
        type: RESOURCE_TYPES.WATER,
        current: 10,
        capacity: 100,
        percentage: 10,
        isCritical: true,
        centers: [{ id: 'a', name: 'Centro A', percentage: 5 }, { id: 'b', name: 'Centro B', percentage: 80 }],
      }],
    }))
    expect(recs.length).toBeGreaterThanOrEqual(1)
    const resourceRecs = recs.filter((r) => r.category === RECOMMENDATION_CATEGORIES.RESOURCE)
    expect(resourceRecs.length).toBeGreaterThanOrEqual(1)
    expect(resourceRecs.some((r) => r.action.toLowerCase().includes('redistribuir'))).toBe(true)
  })

  it('recomienda activar voluntarios cuando disponibles es 0 y hay misiones', () => {
    const recs = generateRecommendations(baseInput({ availableVolunteers: 0, activeMissions: 3 }))
    const volunteerRecs = recs.filter((r) => r.category === RECOMMENDATION_CATEGORIES.VOLUNTEER)
    expect(volunteerRecs.some((r) => r.action.includes('reserva'))).toBe(true)
  })

  it('recomienda centros críticos cuando hay zonas críticas', () => {
    const recs = generateRecommendations(baseInput({
      heatZones: [{
        id: 'z-1',
        name: 'Zona Sur',
        classification: ZONE_CLASSIFICATIONS.CRITICAL,
        center: { lat: 10.5, lng: -66.9 },
        radius: 5,
        caseCount: 50,
        reportCount: 100,
        resourceScore: 10,
        trend: TREND_DIRECTIONS.UP,
        lastUpdated: new Date(),
      }],
    }))
    const centerRecs = recs.filter((r) => r.category === RECOMMENDATION_CATEGORIES.CENTER)
    expect(centerRecs.some((r) => r.action.includes('Reforzar'))).toBe(true)
  })

  it('recomienda apertura de refugio con más de 2 zonas calientes', () => {
    const makeZone = (id: string) => ({
      id,
      name: `Zona ${id}`,
      classification: 'hot' as 'hot',
      center: { lat: 10.5, lng: -66.9 },
      radius: 5,
      caseCount: 30,
      reportCount: 50,
      resourceScore: 40,
      trend: 'up' as 'up',
      lastUpdated: new Date(),
    })
    const recs = generateRecommendations(baseInput({
      heatZones: [makeZone('a'), makeZone('b'), makeZone('c')],
    }))
    expect(recs.some((r) => r.action.includes('refugio'))).toBe(true)
  })

  it('recomienda escalar al Operations Hub con >10 SLAs incumplidos', () => {
    const recs = generateRecommendations(baseInput({ breachedSlaCount: 15 }))
    const escalationRecs = recs.filter((r) => r.category === RECOMMENDATION_CATEGORIES.ESCALATION)
    expect(escalationRecs.some((r) => r.action.includes('Operations Hub'))).toBe(true)
  })

  it('recomienda apoyo externo cuando casos críticos > 30%', () => {
    const recs = generateRecommendations(baseInput({
      metrics: {
        totalCases: 20,
        criticalCases: 10,
        saturatedCenters: 1,
        operationalCenters: 5,
        offlineCenters: 0,
        activeVolunteers: 15,
        availableVolunteers: 8,
        activeMissions: 6,
        criticalMissions: 1,
        avgAttentionMinutes: 20,
        avgArrivalMinutes: 15,
        breachedSlaCount: 0,
        totalReports: 50,
        pendingReports: 10,
      },
    }))
    expect(recs.some((r) => r.action.includes('apoyo externo'))).toBe(true)
  })

  it('recomienda evacuación para zonas críticas con tendencia surge', () => {
    const recs = generateRecommendations(baseInput({
      heatZones: [{
        id: 'z-1',
        name: 'Zona Peligrosa',
        classification: ZONE_CLASSIFICATIONS.CRITICAL,
        center: { lat: 10.5, lng: -66.9 },
        radius: 5,
        caseCount: 80,
        reportCount: 200,
        resourceScore: 5,
        trend: TREND_DIRECTIONS.SURGE,
        lastUpdated: new Date(),
      }],
    }))
    expect(recs.some((r) => r.category === RECOMMENDATION_CATEGORIES.EVACUATION && r.action.includes('evacuación'))).toBe(true)
  })

  it('recomienda skills faltantes cuando demanda > 3', () => {
    const recs = generateRecommendations(baseInput({
      demand: {
        mostNeededResources: [],
        mostNeededSkills: [{ skill: 'paramedic', count: 5, label: 'Paramédico' }],
        worseningZones: [],
        centersNeedingSupport: [],
      },
    }))
    expect(recs.some((r) => r.action.includes('Paramédico'))).toBe(true)
  })

  it('ordena por prioridad (critical primero)', () => {
    const recs = generateRecommendations(baseInput({
      availableVolunteers: 0,
      activeMissions: 3,
      breachedSlaCount: 15,
      resources: [{
        type: RESOURCE_TYPES.WATER,
        current: 5,
        capacity: 100,
        percentage: 5,
        isCritical: true,
        centers: [{ id: 'a', name: 'A', percentage: 2 }, { id: 'b', name: 'B', percentage: 90 }],
      }],
    }))
    const priorities = recs.map((r) => r.priority)
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i - 1]])
    }
  })

  it('cada recomendación tiene id, timestamp, confidence', () => {
    const recs = generateRecommendations(baseInput({
      breachedSlaCount: 15,
      resources: [{
        type: RESOURCE_TYPES.WATER,
        current: 5,
        capacity: 100,
        percentage: 5,
        isCritical: true,
        centers: [{ id: 'a', name: 'A', percentage: 2 }, { id: 'b', name: 'B', percentage: 90 }],
      }],
    }))
    for (const r of recs) {
      expect(r.id).toBeDefined()
      expect(r.createdAt).toBeDefined()
      expect(r.confidence).toBeGreaterThanOrEqual(0)
      expect(r.action).toBeTruthy()
      expect(r.reason).toBeTruthy()
      expect(r.expectedImpact).toBeTruthy()
    }
  })
})
