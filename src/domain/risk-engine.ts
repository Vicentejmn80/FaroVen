import type { OperationalMetrics, OperationalRisk, RiskFactor } from './operational-intelligence.types'
import { classifyRisk } from './operational-intelligence.types'

export interface RiskEngineInput {
  metrics: OperationalMetrics
  resourcePercentages: number[]
  recentReportRate: number
  criticalEventCount: number
  responseTimeMinutes: number
  slaBreachCount: number
}

export function calculateRiskScore(input: RiskEngineInput): OperationalRisk {
  const factors: RiskFactor[] = []

  factors.push(createFactor(
    'Casos abiertos',
    20,
    scoreOpenCases(input.metrics.totalCases, input.metrics.criticalCases),
    `${input.metrics.totalCases} casos totales, ${input.metrics.criticalCases} críticos`,
  ))

  factors.push(createFactor(
    'Saturación de centros',
    15,
    scoreSaturation(input.metrics.saturatedCenters, input.metrics.operationalCenters),
    `${input.metrics.saturatedCenters} centros saturados`,
  ))

  factors.push(createFactor(
    'Recursos críticos',
    20,
    scoreResources(input.resourcePercentages),
    `${input.resourcePercentages.filter((p) => p < 20).length} recursos bajo 20%`,
  ))

  factors.push(createFactor(
    'Disponibilidad de voluntarios',
    15,
    scoreVolunteers(input.metrics.availableVolunteers, input.metrics.activeVolunteers),
    `${input.metrics.availableVolunteers} disponibles, ${input.metrics.activeVolunteers} activos`,
  ))

  factors.push(createFactor(
    'Tiempo de respuesta',
    10,
    scoreResponseTime(input.responseTimeMinutes),
    `Promedio ${input.responseTimeMinutes} min`,
  ))

  factors.push(createFactor(
    'Incumplimiento SLA',
    10,
    scoreSla(input.slaBreachCount),
    `${input.slaBreachCount} SLAs incumplidos`,
  ))

  factors.push(createFactor(
    'Tasa de reportes recientes',
    5,
    scoreReportRate(input.recentReportRate),
    `${input.recentReportRate} reportes recientes`,
  ))

  factors.push(createFactor(
    'Eventos críticos',
    5,
    scoreCriticalEvents(input.criticalEventCount),
    `${input.criticalEventCount} eventos críticos`,
  ))

  const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0)
  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)))

  return {
    score: finalScore,
    level: classifyRisk(finalScore),
    factors,
    timestamp: new Date(),
  }
}

function createFactor(name: string, weight: number, score: number, detail: string): RiskFactor {
  const contribution = Math.round((weight * score) / 100)
  const status = score >= 70 ? 'critical' as const : score >= 40 ? 'elevated' as const : 'normal' as const
  return { name, weight, score, contribution, status, detail }
}

function scoreOpenCases(totalCases: number, criticalCases: number): number {
  if (totalCases === 0) return 0
  const criticalRatio = criticalCases / Math.max(totalCases, 1)
  const baseScore = Math.min(totalCases / 10, 50)
  const criticalBonus = criticalRatio * 50
  return Math.min(100, Math.round(baseScore + criticalBonus))
}

function scoreSaturation(saturated: number, operational: number): number {
  const total = saturated + operational
  if (total === 0) return 0
  return Math.min(100, Math.round((saturated / Math.max(total, 1)) * 100))
}

function scoreResources(percentages: number[]): number {
  if (percentages.length === 0) return 0
  const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length
  return Math.min(100, Math.round((100 - avg) * 1.5))
}

function scoreVolunteers(available: number, active: number): number {
  const total = available + active
  if (total === 0) return 80
  const ratio = available / Math.max(total, 1)
  if (ratio === 0) return 100
  if (ratio < 0.2) return 70
  if (ratio < 0.4) return 40
  return Math.round((1 - ratio) * 50)
}

function scoreResponseTime(minutes: number): number {
  if (minutes <= 5) return 0
  if (minutes <= 15) return 20
  if (minutes <= 30) return 40
  if (minutes <= 60) return 60
  if (minutes <= 120) return 80
  return 100
}

function scoreSla(breaches: number): number {
  if (breaches === 0) return 0
  if (breaches <= 2) return 20
  if (breaches <= 5) return 40
  if (breaches <= 10) return 60
  if (breaches <= 20) return 80
  return 100
}

function scoreReportRate(rate: number): number {
  if (rate <= 5) return 0
  if (rate <= 15) return 20
  if (rate <= 30) return 40
  if (rate <= 60) return 60
  if (rate <= 100) return 80
  return 100
}

function scoreCriticalEvents(count: number): number {
  if (count === 0) return 0
  if (count <= 1) return 20
  if (count <= 3) return 40
  if (count <= 5) return 60
  if (count <= 10) return 80
  return 100
}
