import { describe, it, expect } from 'vitest'
import {
  detectTrend,
  generateTrendPoints,
  computeRateOfChange,
  predictNextValue,
  predictResourceDepletion,
} from '../trend-engine'
import { TREND_DIRECTIONS } from '../operational-intelligence.types'

describe('detectTrend', () => {
  it('retorna stable con menos de 2 puntos', () => {
    const result = detectTrend({ metric: 'reportes', points: [{ value: 10, timestamp: new Date() }] })
    expect(result.direction).toBe(TREND_DIRECTIONS.STABLE)
  })

  it('detecta tendencia UP con aumento significativo', () => {
    const base = new Date()
    const result = detectTrend({
      metric: 'reportes',
      points: [
        { value: 10, timestamp: new Date(base.getTime() - 60000) },
        { value: 25, timestamp: base },
      ],
      surgeThreshold: 100,
    })
    expect(result.direction).toBe(TREND_DIRECTIONS.UP)
    expect(result.changePercent).toBe(150)
  })

  it('detecta SURGE con aceleración en 3+ puntos', () => {
    const base = new Date()
    const result = detectTrend({
      metric: 'reportes',
      points: [
        { value: 10, timestamp: new Date(base.getTime() - 30000) },
        { value: 20, timestamp: new Date(base.getTime() - 15000) },
        { value: 35, timestamp: base },
      ],
    })
    expect(result.direction).toBe(TREND_DIRECTIONS.SURGE)
    expect(result.isAlert).toBe(true)
    expect(result.alertMessage).toContain('escalada')
  })

  it('detecta COLLAPSE con caída significativa', () => {
    const base = new Date()
    const result = detectTrend({
      metric: 'recursos',
      points: [
        { value: 100, timestamp: new Date(base.getTime() - 60000) },
        { value: 30, timestamp: base },
      ],
      collapseThreshold: -50,
    })
    expect(result.direction).toBe(TREND_DIRECTIONS.COLLAPSE)
    expect(result.isAlert).toBe(true)
    expect(result.alertMessage).toContain('colapso')
  })

  it('detecta DOWN con caída moderada', () => {
    const base = new Date()
    const result = detectTrend({
      metric: 'recursos',
      points: [
        { value: 100, timestamp: new Date(base.getTime() - 60000) },
        { value: 85, timestamp: base },
      ],
      collapseThreshold: -50,
    })
    expect(result.direction).toBe(TREND_DIRECTIONS.DOWN)
  })

  it('detecta STABLE con cambios mínimos', () => {
    const base = new Date()
    const result = detectTrend({
      metric: 'estable',
      points: [
        { value: 50, timestamp: new Date(base.getTime() - 60000) },
        { value: 52, timestamp: base },
      ],
    })
    expect(result.direction).toBe(TREND_DIRECTIONS.STABLE)
  })

  it('changePercent = 0 cuando previousValue es 0 y current también', () => {
    const base = new Date()
    const result = detectTrend({
      metric: 'vacio',
      points: [
        { value: 0, timestamp: new Date(base.getTime() - 60000) },
        { value: 0, timestamp: base },
      ],
    })
    expect(result.changePercent).toBe(0)
  })

  it('changePercent = 100 cuando previousValue es 0 y current > 0', () => {
    const base = new Date()
    const result = detectTrend({
      metric: 'nuevo',
      points: [
        { value: 0, timestamp: new Date(base.getTime() - 60000) },
        { value: 50, timestamp: base },
      ],
    })
    expect(result.changePercent).toBe(100)
  })
})

describe('generateTrendPoints', () => {
  it('genera puntos con timestamps espaciados', () => {
    const base = new Date('2026-07-17T10:00:00Z')
    const points = generateTrendPoints([10, 20, 30], base, 10)
    expect(points).toHaveLength(3)
    expect(points[0].value).toBe(10)
    expect(points[1].timestamp.getTime()).toBe(base.getTime() + 10 * 60000)
    expect(points[2].timestamp.getTime()).toBe(base.getTime() + 20 * 60000)
  })
})

describe('computeRateOfChange', () => {
  it('retorna 0 con menos de 2 puntos', () => {
    expect(computeRateOfChange([{ value: 10, timestamp: new Date() }])).toBe(0)
  })

  it('calcula tasa por hora', () => {
    const base = new Date()
    const points = [
      { value: 10, timestamp: base },
      { value: 30, timestamp: new Date(base.getTime() + 30 * 60000) },
    ]
    const rate = computeRateOfChange(points)
    expect(rate).toBe(40)
  })
})

describe('predictNextValue', () => {
  it('retorna el único valor con 1 punto', () => {
    expect(predictNextValue([{ value: 42, timestamp: new Date() }])).toBe(42)
  })

  it('predice siguiente valor basado en delta promedio', () => {
    const base = new Date()
    const points = [
      { value: 10, timestamp: base },
      { value: 20, timestamp: new Date(base.getTime() + 60000) },
      { value: 30, timestamp: new Date(base.getTime() + 120000) },
    ]
    const next = predictNextValue(points)
    expect(next).toBe(40)
  })
})

describe('predictResourceDepletion', () => {
  it('retorna willDeplete false si netRate <= 0', () => {
    const result = predictResourceDepletion(100, 10, 10)
    expect(result.willDeplete).toBe(false)
    expect(result.hoursUntilDepletion).toBeNull()
  })

  it('calcula horas hasta agotamiento', () => {
    const result = predictResourceDepletion(100, 20, 5)
    expect(result.willDeplete).toBe(true)
    expect(result.hoursUntilDepletion).toBe(7)
  })
})
