import {
  type SimulationScenario,
  type SimulationConfig,
  type SimulationState,
  type SimulationEvent,
} from './operational-intelligence.types'

export interface SimulationInput {
  name: string
  scenario: SimulationScenario
  intensity: number
  durationMinutes: number
  citizenCount: number
  centerCount: number
  volunteerCount: number
  resourceAmount: number
  generationSpeed: number
}

export function createSimulation(input: SimulationInput): SimulationState {
  const config: SimulationConfig = {
    scenario: input.scenario,
    intensity: clamp(input.intensity, 1, 10),
    durationMinutes: clamp(input.durationMinutes, 10, 1440),
    citizenCount: clamp(input.citizenCount, 10, 100000),
    centerCount: clamp(input.centerCount, 1, 50),
    volunteerCount: clamp(input.volunteerCount, 5, 500),
    resourceAmount: clamp(input.resourceAmount, 10, 1000),
    generationSpeed: clamp(input.generationSpeed, 1, 10),
  }

  return {
    id: crypto.randomUUID(),
    name: input.name,
    config,
    status: 'running',
    elapsedMinutes: 0,
    events: [],
    metrics: {
      reportsGenerated: 0,
      casesCreated: 0,
      missionsCreated: 0,
      volunteersActivated: 0,
      centersSaturated: 0,
      resourcesDepleted: 0,
      criticalEvents: 0,
    },
    createdAt: new Date(),
  }
}

export function tickSimulation(state: SimulationState, tickMinutes: number = 1): SimulationState {
  if (state.status !== 'running') return state

  const newElapsed = state.elapsedMinutes + tickMinutes
  if (newElapsed >= state.config.durationMinutes) {
    return { ...completeSimulation(state), elapsedMinutes: state.config.durationMinutes }
  }

  const newEvents: SimulationEvent[] = []
  const newMetrics = { ...state.metrics }
  const speedFactor = state.config.generationSpeed / 5
  const intensityFactor = state.config.intensity / 5
  const scenario = state.config.scenario

  const reportChance = 0.3 * speedFactor * intensityFactor
  if (Math.random() < reportChance) {
    newEvents.push(generateReportEvent(scenario, newElapsed))
    newMetrics.reportsGenerated++
  }

  const caseChance = 0.15 * speedFactor * intensityFactor
  if (Math.random() < caseChance && newMetrics.reportsGenerated > newMetrics.casesCreated) {
    newEvents.push(generateCaseEvent(scenario, newElapsed))
    newMetrics.casesCreated++
  }

  const missionChance = 0.1 * speedFactor * intensityFactor
  if (Math.random() < missionChance && newMetrics.casesCreated > 0) {
    newEvents.push(generateMissionEvent(scenario, newElapsed))
    newMetrics.missionsCreated++
  }

  const saturationChance = 0.05 * intensityFactor
  if (Math.random() < saturationChance) {
    newEvents.push(generateSaturationEvent(newElapsed))
    newMetrics.centersSaturated++
  }

  const resourceChance = 0.08 * intensityFactor
  if (Math.random() < resourceChance) {
    newEvents.push(generateResourceEvent(scenario, newElapsed))
    newMetrics.resourcesDepleted++
  }

  if (newElapsed % 10 === 0 && state.config.volunteerCount > 0) {
    const volunteerActivationCount = Math.min(
      Math.ceil(state.config.volunteerCount * 0.1 * speedFactor),
      state.config.volunteerCount - newMetrics.volunteersActivated,
    )
    if (volunteerActivationCount > 0) {
      newMetrics.volunteersActivated += volunteerActivationCount
      newEvents.push({
        id: crypto.randomUUID(),
        type: 'notification',
        timestamp: new Date(),
        description: `${volunteerActivationCount} voluntarios activados`,
        severity: 'low',
      })
    }
  }

  if (newMetrics.centersSaturated >= state.config.centerCount * 0.5 && Math.random() < 0.2) {
    newEvents.push({
      id: crypto.randomUUID(),
      type: 'escalation',
      timestamp: new Date(),
      description: `Alarma: ${Math.round((newMetrics.centersSaturated / Math.max(state.config.centerCount, 1)) * 100)}% de centros saturados`,
      severity: 'critical',
    })
    newMetrics.criticalEvents++
  }

  return {
    ...state,
    elapsedMinutes: newElapsed,
    events: [...state.events, ...newEvents],
    metrics: newMetrics,
  }
}

export function pauseSimulation(state: SimulationState): SimulationState {
  if (state.status !== 'running') return state
  return { ...state, status: 'paused' }
}

export function resumeSimulation(state: SimulationState): SimulationState {
  if (state.status !== 'paused') return state
  return { ...state, status: 'running' }
}

export function completeSimulation(state: SimulationState): SimulationState {
  return { ...state, status: 'completed' }
}

function generateReportEvent(scenario: SimulationScenario, elapsed: number): SimulationEvent {
  const descriptions: Record<SimulationScenario, string[]> = {
    flood: ['Inundación reportada en sector residencial', 'Agua alcanza nivel crítico', 'Familia atrapada por crecida'],
    earthquake: ['Edificio colapsado', 'Réplica sísmica sentida', 'Persona atrapada bajo escombros'],
    fire: ['Incendio forestal avanza', 'Vivienda en llamas', 'Humo tóxico reportado'],
    landslide: ['Deslizamiento bloquea vía principal', 'Vivienda amenazada por derrumbe', 'Carretera cortada'],
    blackout: ['Apagón masivo reportado', 'Hospital sin electricidad', 'Semáforos fuera de servicio'],
    mass_accident: ['Choque múltiple en autopista', 'Vehículo volcado', 'Heridos múltiples reportados'],
  }
  const list = descriptions[scenario]
  return {
    id: crypto.randomUUID(),
    type: 'report',
    timestamp: new Date(),
    description: list[Math.floor(Math.random() * list.length)],
    severity: elapsed < 30 ? 'high' : 'medium',
  }
}

function generateCaseEvent(scenario: SimulationScenario, elapsed: number): SimulationEvent {
  const descriptions: Record<SimulationScenario, string[]> = {
    flood: ['Caso de rescate acuático creado', 'Refugio temporal habilitado'],
    earthquake: ['Equipo de búsqueda desplegado', 'Centro de acopio activado'],
    fire: ['Evacuación preventiva iniciada', 'Caso de quema controlada'],
    landslide: ['Despeje de vía iniciado', 'Ruta alterna habilitada'],
    blackout: ['Planta eléctrica móvil enviada', 'Caso de restauración eléctrica'],
    mass_accident: ['Triage en sitio establecido', 'Hospital activa código masivo'],
  }
  const list = descriptions[scenario]
  return {
    id: crypto.randomUUID(),
    type: 'case',
    timestamp: new Date(),
    description: list[Math.floor(Math.random() * list.length)],
    severity: elapsed < 30 ? 'critical' : 'high',
  }
}

function generateMissionEvent(scenario: SimulationScenario, elapsed: number): SimulationEvent {
  const descriptions: Record<SimulationScenario, string[]> = {
    flood: ['Misión de rescate acuático asignada', 'Misión de distribución de agua'],
    earthquake: ['Misión de búsqueda y rescate', 'Misión de evaluación estructural'],
    fire: ['Misión de combate de incendio', 'Misión de evacuación'],
    landslide: ['Misión de despeje de escombros', 'Misión de evaluación geológica'],
    blackout: ['Misión de reparación eléctrica', 'Misión de distribución de generadores'],
    mass_accident: ['Misión de atención prehospitalaria', 'Misión de transporte de heridos'],
  }
  const list = descriptions[scenario]
  return {
    id: crypto.randomUUID(),
    type: 'mission',
    timestamp: new Date(),
    description: list[Math.floor(Math.random() * list.length)],
    severity: elapsed < 30 ? 'high' : 'medium',
  }
}

function generateSaturationEvent(elapsed: number): SimulationEvent {
  const descriptions = [
    'Centro de salud alcanza capacidad máxima',
    'Refugio supera ocupación límite',
    'Centro de distribución colapsado',
  ]
  return {
    id: crypto.randomUUID(),
    type: 'saturation',
    timestamp: new Date(),
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    severity: elapsed < 30 ? 'critical' : 'high',
  }
}

function generateResourceEvent(scenario: SimulationScenario, elapsed: number): SimulationEvent {
  const descriptions: Record<SimulationScenario, string[]> = {
    flood: ['Agua potable agotada', 'Botes de rescate insuficientes'],
    earthquake: ['Medicamentos agotados', 'Equipo de rescate insuficiente'],
    fire: ['Combustible crítico', 'Equipo contra incendio agotado'],
    landslide: ['Maquinaria pesada insuficiente', 'Combustible para equipos crítico'],
    blackout: ['Combustible para generadores crítico', 'Baterías de respaldo agotadas'],
    mass_accident: ['Sangre y plasma crítico', 'Medicamentos de emergencia agotados'],
  }
  const list = descriptions[scenario]
  return {
    id: crypto.randomUUID(),
    type: 'resource',
    timestamp: new Date(),
    description: list[Math.floor(Math.random() * list.length)],
    severity: elapsed < 30 ? 'critical' : 'high',
  }
}

export function getScenarioDefaultConfig(scenario: SimulationScenario): Omit<SimulationInput, 'name'> {
  const defaults: Record<SimulationScenario, Omit<SimulationInput, 'name' | 'scenario'>> = {
    flood: { intensity: 7, durationMinutes: 120, citizenCount: 5000, centerCount: 8, volunteerCount: 50, resourceAmount: 200, generationSpeed: 5 },
    earthquake: { intensity: 9, durationMinutes: 180, citizenCount: 20000, centerCount: 15, volunteerCount: 100, resourceAmount: 500, generationSpeed: 6 },
    fire: { intensity: 6, durationMinutes: 90, citizenCount: 2000, centerCount: 5, volunteerCount: 30, resourceAmount: 100, generationSpeed: 4 },
    landslide: { intensity: 5, durationMinutes: 60, citizenCount: 1000, centerCount: 3, volunteerCount: 20, resourceAmount: 80, generationSpeed: 3 },
    blackout: { intensity: 4, durationMinutes: 240, citizenCount: 10000, centerCount: 10, volunteerCount: 40, resourceAmount: 150, generationSpeed: 2 },
    mass_accident: { intensity: 6, durationMinutes: 60, citizenCount: 500, centerCount: 4, volunteerCount: 40, resourceAmount: 100, generationSpeed: 7 },
  }
  return { ...defaults[scenario], scenario }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
