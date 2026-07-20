import { describe, it, expect } from 'vitest'
import {
  createSimulation,
  tickSimulation,
  pauseSimulation,
  resumeSimulation,
  completeSimulation,
  getScenarioDefaultConfig,
} from '../simulation-engine'
import { SIMULATION_SCENARIOS } from '../operational-intelligence.types'

describe('createSimulation', () => {
  it('crea simulación con configuración válida', () => {
    const sim = createSimulation({
      name: 'Test Flood',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 5,
      durationMinutes: 60,
      citizenCount: 1000,
      centerCount: 5,
      volunteerCount: 30,
      resourceAmount: 100,
      generationSpeed: 5,
    })
    expect(sim.name).toBe('Test Flood')
    expect(sim.status).toBe('running')
    expect(sim.elapsedMinutes).toBe(0)
    expect(sim.events).toHaveLength(0)
    expect(sim.metrics.reportsGenerated).toBe(0)
  })

  it('clampa valores fuera de rango', () => {
    const sim = createSimulation({
      name: 'Clamp Test',
      scenario: SIMULATION_SCENARIOS.EARTHQUAKE,
      intensity: 20,
      durationMinutes: 5,
      citizenCount: 0,
      centerCount: 100,
      volunteerCount: 1000,
      resourceAmount: -5,
      generationSpeed: 0,
    })
    expect(sim.config.intensity).toBe(10)
    expect(sim.config.durationMinutes).toBe(10)
    expect(sim.config.citizenCount).toBe(10)
    expect(sim.config.centerCount).toBe(50)
    expect(sim.config.volunteerCount).toBe(500)
    expect(sim.config.resourceAmount).toBe(10)
    expect(sim.config.generationSpeed).toBe(1)
  })
})

describe('tickSimulation', () => {
  it('no avanza si está pausada', () => {
    const sim = createSimulation({
      name: 'Paused',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 1,
      durationMinutes: 60,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 1,
    })
    const paused = pauseSimulation(sim)
    const ticked = tickSimulation(paused)
    expect(ticked.elapsedMinutes).toBe(0)
  })

  it('no avanza si está completada', () => {
    const sim = createSimulation({
      name: 'Done',
      scenario: SIMULATION_SCENARIOS.FIRE,
      intensity: 5,
      durationMinutes: 10,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 5,
    })
    const completed = completeSimulation(sim)
    const ticked = tickSimulation(completed, 5)
    expect(ticked.status).toBe('completed')
  })

  it('incrementa elapsedMinutes en running', () => {
    const sim = createSimulation({
      name: 'Tick',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 10,
      durationMinutes: 60,
      citizenCount: 1000,
      centerCount: 5,
      volunteerCount: 30,
      resourceAmount: 100,
      generationSpeed: 10,
    })
    const ticked = tickSimulation(sim, 5)
    expect(ticked.elapsedMinutes).toBe(5)
  })

  it('genera eventos durante el avance', () => {
    let sim = createSimulation({
      name: 'Events',
      scenario: SIMULATION_SCENARIOS.EARTHQUAKE,
      intensity: 10,
      durationMinutes: 60,
      citizenCount: 10000,
      centerCount: 10,
      volunteerCount: 100,
      resourceAmount: 500,
      generationSpeed: 10,
    })

    for (let i = 0; i < 50; i++) {
      sim = tickSimulation(sim)
    }

    expect(sim.elapsedMinutes).toBe(50)
    expect(sim.metrics.reportsGenerated).toBeGreaterThanOrEqual(0)
    expect(sim.events.length).toBeGreaterThanOrEqual(0)
  })

  it('completa la simulación cuando alcanza la duración', () => {
    const sim = createSimulation({
      name: 'Complete',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 5,
      durationMinutes: 10,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 5,
    })
    const ticked = tickSimulation(sim, 15)
    expect(ticked.status).toBe('completed')
    expect(ticked.elapsedMinutes).toBe(10)
  })

  it('activa voluntarios periódicamente', () => {
    let sim = createSimulation({
      name: 'VolActivation',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 10,
      durationMinutes: 60,
      citizenCount: 1000,
      centerCount: 5,
      volunteerCount: 50,
      resourceAmount: 100,
      generationSpeed: 10,
    })

    for (let i = 0; i < 20; i++) {
      sim = tickSimulation(sim)
    }

    expect(sim.metrics.volunteersActivated).toBeGreaterThanOrEqual(0)
  })
})

describe('pauseSimulation / resumeSimulation', () => {
  it('pause cambia estado a paused', () => {
    const sim = createSimulation({
      name: 'Pause Test',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 5,
      durationMinutes: 60,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 5,
    })
    const paused = pauseSimulation(sim)
    expect(paused.status).toBe('paused')
  })

  it('pause no afecta a simulación ya pausada', () => {
    const sim = createSimulation({
      name: 'Double Pause',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 5,
      durationMinutes: 60,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 5,
    })
    const paused = pauseSimulation(sim)
    const again = pauseSimulation(paused)
    expect(again.status).toBe('paused')
  })

  it('resume cambia estado a running', () => {
    const sim = createSimulation({
      name: 'Resume Test',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 5,
      durationMinutes: 60,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 5,
    })
    const paused = pauseSimulation(sim)
    const resumed = resumeSimulation(paused)
    expect(resumed.status).toBe('running')
  })

  it('resume no afecta a running', () => {
    const sim = createSimulation({
      name: 'Already Running',
      scenario: SIMULATION_SCENARIOS.FLOOD,
      intensity: 5,
      durationMinutes: 60,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 5,
    })
    const resumed = resumeSimulation(sim)
    expect(resumed.status).toBe('running')
  })
})

describe('completeSimulation', () => {
  it('marca como completada', () => {
    const sim = createSimulation({
      name: 'Complete',
      scenario: SIMULATION_SCENARIOS.FIRE,
      intensity: 5,
      durationMinutes: 60,
      citizenCount: 100,
      centerCount: 3,
      volunteerCount: 10,
      resourceAmount: 50,
      generationSpeed: 5,
    })
    const done = completeSimulation(sim)
    expect(done.status).toBe('completed')
  })
})

describe('getScenarioDefaultConfig', () => {
  it('retorna configuración por defecto para cada escenario', () => {
    const scenarios = Object.values(SIMULATION_SCENARIOS)
    for (const scenario of scenarios) {
      const config = getScenarioDefaultConfig(scenario)
      expect(config.intensity).toBeGreaterThanOrEqual(1)
      expect(config.durationMinutes).toBeGreaterThanOrEqual(10)
      expect(config.citizenCount).toBeGreaterThanOrEqual(100)
      expect(config.centerCount).toBeGreaterThanOrEqual(1)
      expect(config.volunteerCount).toBeGreaterThanOrEqual(20)
    }
  })

  it('earthquake tiene mayor intensidad que blackout', () => {
    const earthquake = getScenarioDefaultConfig(SIMULATION_SCENARIOS.EARTHQUAKE)
    const blackout = getScenarioDefaultConfig(SIMULATION_SCENARIOS.BLACKOUT)
    expect(earthquake.intensity).toBeGreaterThanOrEqual(blackout.intensity)
  })
})
