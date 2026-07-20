import { describe, it, expect } from 'vitest'
import { calculateRiskScore, type RiskEngineInput } from '../risk-engine'
import { classifyRisk, RISK_THRESHOLDS } from '../operational-intelligence.types'

function baseInput(overrides?: Partial<RiskEngineInput>): RiskEngineInput {
  return {
    metrics: {
      totalCases: 10,
      criticalCases: 1,
      saturatedCenters: 0,
      operationalCenters: 5,
      offlineCenters: 0,
      activeVolunteers: 20,
      availableVolunteers: 10,
      activeMissions: 5,
      criticalMissions: 0,
      avgAttentionMinutes: 15,
      avgArrivalMinutes: 10,
      breachedSlaCount: 0,
      totalReports: 30,
      pendingReports: 5,
    },
    resourcePercentages: [60, 70, 80],
    recentReportRate: 30,
    criticalEventCount: 0,
    responseTimeMinutes: 15,
    slaBreachCount: 0,
    ...overrides,
  }
}

describe('calculateRiskScore', () => {
  it('retorna riesgo bajo con parámetros normales', () => {
    const result = calculateRiskScore(baseInput())
    expect(result.level).toBe('low')
    expect(result.score).toBeLessThanOrEqual(RISK_THRESHOLDS.LOW_MAX)
    expect(result.factors).toHaveLength(8)
  })

  it('retorna riesgo crítico con máximos', () => {
    const result = calculateRiskScore(baseInput({
      metrics: {
        totalCases: 500,
        criticalCases: 200,
        saturatedCenters: 10,
        operationalCenters: 0,
        offlineCenters: 5,
        activeVolunteers: 0,
        availableVolunteers: 0,
        activeMissions: 20,
        criticalMissions: 15,
        avgAttentionMinutes: 240,
        avgArrivalMinutes: 120,
        breachedSlaCount: 50,
        totalReports: 500,
        pendingReports: 200,
      },
      resourcePercentages: [5, 10, 3],
      recentReportRate: 200,
      criticalEventCount: 15,
      responseTimeMinutes: 240,
      slaBreachCount: 50,
    }))
    expect(result.level).toBe('critical')
    expect(result.score).toBeGreaterThanOrEqual(RISK_THRESHOLDS.HIGH_MAX)
    expect(result.factors.every((f) => f.status === 'critical' || f.status === 'elevated')).toBe(true)
  })

  it('retorna riesgo medio con parámetros intermedios', () => {
    const result = calculateRiskScore(baseInput({
      metrics: {
        totalCases: 80,
        criticalCases: 15,
        saturatedCenters: 3,
        operationalCenters: 5,
        offlineCenters: 1,
        activeVolunteers: 10,
        availableVolunteers: 3,
        activeMissions: 8,
        criticalMissions: 3,
        avgAttentionMinutes: 45,
        avgArrivalMinutes: 30,
        breachedSlaCount: 8,
        totalReports: 100,
        pendingReports: 30,
      },
      resourcePercentages: [25, 30, 40],
      recentReportRate: 60,
      criticalEventCount: 3,
      responseTimeMinutes: 45,
      slaBreachCount: 8,
    }))
    expect(result.score).toBeGreaterThan(RISK_THRESHOLDS.LOW_MAX)
    expect(result.score).toBeLessThanOrEqual(RISK_THRESHOLDS.HIGH_MAX)
  })

  it('incluye timestamp en el resultado', () => {
    const before = new Date()
    const result = calculateRiskScore(baseInput())
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('cada factor tiene contribution = weight * score / 100', () => {
    const result = calculateRiskScore(baseInput())
    for (const f of result.factors) {
      const expected = Math.round((f.weight * f.score) / 100)
      expect(f.contribution).toBe(expected)
    }
  })

  it('suma de contribuciones = score total', () => {
    const result = calculateRiskScore(baseInput())
    const sum = result.factors.reduce((a, f) => a + f.contribution, 0)
    expect(Math.abs(result.score - sum)).toBeLessThanOrEqual(1)
  })

  it('score mínimo es 0', () => {
    const result = calculateRiskScore(baseInput({
      metrics: {
        totalCases: 0,
        criticalCases: 0,
        saturatedCenters: 0,
        operationalCenters: 5,
        offlineCenters: 0,
        activeVolunteers: 50,
        availableVolunteers: 25,
        activeMissions: 0,
        criticalMissions: 0,
        avgAttentionMinutes: 0,
        avgArrivalMinutes: 0,
        breachedSlaCount: 0,
        totalReports: 0,
        pendingReports: 0,
      },
      resourcePercentages: [100, 100, 100],
      recentReportRate: 0,
      criticalEventCount: 0,
      responseTimeMinutes: 0,
      slaBreachCount: 0,
    }))
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('score máximo es 100', () => {
    const result = calculateRiskScore(baseInput({
      metrics: {
        totalCases: 10000,
        criticalCases: 5000,
        saturatedCenters: 100,
        operationalCenters: 0,
        offlineCenters: 50,
        activeVolunteers: 0,
        availableVolunteers: 0,
        activeMissions: 100,
        criticalMissions: 100,
        avgAttentionMinutes: 999,
        avgArrivalMinutes: 999,
        breachedSlaCount: 999,
        totalReports: 9999,
        pendingReports: 5000,
      },
      resourcePercentages: [0, 0, 0, 0],
      recentReportRate: 9999,
      criticalEventCount: 100,
      responseTimeMinutes: 999,
      slaBreachCount: 999,
    }))
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

describe('classifyRisk', () => {
  it('0 es low', () => expect(classifyRisk(0)).toBe('low'))
  it('25 es low', () => expect(classifyRisk(25)).toBe('low'))
  it('26 es medium', () => expect(classifyRisk(26)).toBe('medium'))
  it('50 es medium', () => expect(classifyRisk(50)).toBe('medium'))
  it('51 es high', () => expect(classifyRisk(51)).toBe('high'))
  it('75 es high', () => expect(classifyRisk(75)).toBe('high'))
  it('76 es critical', () => expect(classifyRisk(76)).toBe('critical'))
  it('100 es critical', () => expect(classifyRisk(100)).toBe('critical'))
})
