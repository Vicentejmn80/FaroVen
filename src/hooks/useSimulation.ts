import { useState, useCallback, useRef } from 'react'
import type { SimulationState, SimulationScenario } from '@/domain/operational-intelligence.types'
import { createSimulation, tickSimulation, pauseSimulation, resumeSimulation, completeSimulation, getScenarioDefaultConfig } from '@/domain/simulation-engine'

export function useSimulation() {
  const [state, setState] = useState<SimulationState | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback((name: string, scenario: SimulationScenario, overrides?: Partial<{
    intensity: number; durationMinutes: number; citizenCount: number; centerCount: number; volunteerCount: number; resourceAmount: number; generationSpeed: number
  }>) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const defaults = getScenarioDefaultConfig(scenario)
    const input = {
      name,
      scenario,
      intensity: overrides?.intensity ?? defaults.intensity,
      durationMinutes: overrides?.durationMinutes ?? defaults.durationMinutes,
      citizenCount: overrides?.citizenCount ?? defaults.citizenCount,
      centerCount: overrides?.centerCount ?? defaults.centerCount,
      volunteerCount: overrides?.volunteerCount ?? defaults.volunteerCount,
      resourceAmount: overrides?.resourceAmount ?? defaults.resourceAmount,
      generationSpeed: overrides?.generationSpeed ?? defaults.generationSpeed,
    }

    const sim = createSimulation(input)
    setState(sim)
  }, [])

  const tick = useCallback(() => {
    setState((prev) => {
      if (!prev || prev.status !== 'running') return prev
      return tickSimulation(prev)
    })
  }, [])

  const autoRun = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      tick()
    }, 1000)
  }, [tick])

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setState((prev) => prev ? pauseSimulation(prev) : prev)
  }, [])

  const resume = useCallback(() => {
    setState((prev) => prev ? resumeSimulation(prev) : prev)
    autoRun()
  }, [autoRun])

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setState((prev) => prev ? completeSimulation(prev) : prev)
  }, [])

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setState(null)
  }, [])

  return { state, start, tick, autoRun, pause, resume, stop, reset }
}
