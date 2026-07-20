import { TREND_DIRECTIONS, type TrendDirection, type TrendResult, type TrendPoint } from './operational-intelligence.types'

export interface TrendInput {
  metric: string
  points: TrendPoint[]
  windowSize?: number
  surgeThreshold?: number
  collapseThreshold?: number
}

export function detectTrend(input: TrendInput): TrendResult {
  const sorted = [...input.points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  if (sorted.length < 2) {
    return {
      metric: input.metric,
      direction: TREND_DIRECTIONS.STABLE,
      currentValue: sorted[0]?.value ?? 0,
      previousValue: sorted[0]?.value ?? 0,
      changePercent: 0,
      points: sorted,
      isAlert: false,
    }
  }

  const currentValue = sorted[sorted.length - 1].value
  const previousValue = sorted[0].value
  const changePercent = previousValue === 0
    ? (currentValue > 0 ? 100 : 0)
    : Math.round(((currentValue - previousValue) / previousValue) * 100)

  const window = input.windowSize ?? 3
  const recentPoints = sorted.slice(-window)
  const surgeThreshold = input.surgeThreshold ?? 50
  const collapseThreshold = input.collapseThreshold ?? -50

  let direction: TrendDirection

  if (recentPoints.length >= 3 && isAccelerating(recentPoints)) {
    direction = TREND_DIRECTIONS.SURGE
  } else if (changePercent >= surgeThreshold) {
    direction = TREND_DIRECTIONS.UP
  } else if (changePercent <= collapseThreshold) {
    direction = TREND_DIRECTIONS.COLLAPSE
  } else if (changePercent > 5) {
    direction = TREND_DIRECTIONS.UP
  } else if (changePercent < -5) {
    direction = TREND_DIRECTIONS.DOWN
  } else {
    direction = TREND_DIRECTIONS.STABLE
  }

  const isAlert = direction === TREND_DIRECTIONS.SURGE || direction === TREND_DIRECTIONS.COLLAPSE
  const absChange = Math.abs(changePercent)

  let alertMessage: string | undefined
  if (isAlert) {
    if (direction === TREND_DIRECTIONS.SURGE) {
      alertMessage = `${input.metric} aumentó ${absChange}% — posible escalada`
    } else {
      alertMessage = `${input.metric} disminuyó ${absChange}% — posible colapso`
    }
  }

  return {
    metric: input.metric,
    direction,
    currentValue,
    previousValue,
    changePercent,
    points: sorted,
    isAlert,
    alertMessage,
  }
}

function isAccelerating(points: TrendPoint[]): boolean {
  if (points.length < 3) return false
  const deltas: number[] = []
  for (let i = 1; i < points.length; i++) {
    deltas.push(points[i].value - points[i - 1].value)
  }
  for (let i = 1; i < deltas.length; i++) {
    if (deltas[i] <= deltas[i - 1]) return false
  }
  return deltas[deltas.length - 1] > 0
}

export function generateTrendPoints(
  values: number[],
  baseTimestamp: Date,
  intervalMinutes: number,
): TrendPoint[] {
  return values.map((value, i) => ({
    value,
    timestamp: new Date(baseTimestamp.getTime() + i * intervalMinutes * 60000),
  }))
}

export function computeRateOfChange(points: TrendPoint[]): number {
  if (points.length < 2) return 0
  const sorted = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const first = sorted[0].value
  const last = sorted[sorted.length - 1].value
  const elapsedMinutes = (sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime()) / 60000
  if (elapsedMinutes === 0) return 0
  return Math.round(((last - first) / elapsedMinutes) * 60)
}

export function predictNextValue(points: TrendPoint[]): number {
  if (points.length < 2) return points[0]?.value ?? 0
  const sorted = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const deltas = sorted.slice(1).map((p, i) => p.value - sorted[i].value)
  const avgDelta = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
  return sorted[sorted.length - 1].value + avgDelta
}

export function predictResourceDepletion(
  currentLevel: number,
  consumptionRate: number,
  restockRate: number,
): { hoursUntilDepletion: number | null; willDeplete: boolean } {
  const netRate = consumptionRate - restockRate
  if (netRate <= 0) return { hoursUntilDepletion: null, willDeplete: false }
  const hoursUntilDepletion = Math.round(currentLevel / netRate)
  return { hoursUntilDepletion, willDeplete: true }
}
