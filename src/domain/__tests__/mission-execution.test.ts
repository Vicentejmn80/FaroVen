import { describe, it, expect } from 'vitest'
import {
  MISSION_EXECUTION_STAGES,
  VOLUNTEER_NEXT_STAGE,
  awaitsValidation,
  executionProgress,
  isExecutionActive,
  isExecutionStage,
} from '../mission-execution.types'
import { MISSION_EXECUTION_ACTION_LABELS, MISSION_EXECUTION_LABELS } from '@/lib/labels'
import type { MissionAssignmentStatus } from '../mission.types'

describe('etapas de ejecución', () => {
  it('van de la asignación al archivo sin huecos', () => {
    expect(MISSION_EXECUTION_STAGES[0]).toBe('assigned')
    expect(MISSION_EXECUTION_STAGES.at(-1)).toBe('archived')
  })

  it('reconoce solo las etapas del camino feliz', () => {
    expect(isExecutionStage('en_route')).toBe(true)
    expect(isExecutionStage('rejected')).toBe(false)
  })
})

describe('recorrido del voluntario', () => {
  it('encadena aceptar, salir, llegar, ayudar y finalizar', () => {
    expect(VOLUNTEER_NEXT_STAGE.assigned).toBe('accepted')
    expect(VOLUNTEER_NEXT_STAGE.accepted).toBe('en_route')
    expect(VOLUNTEER_NEXT_STAGE.en_route).toBe('on_site')
    expect(VOLUNTEER_NEXT_STAGE.on_site).toBe('in_progress')
    expect(VOLUNTEER_NEXT_STAGE.in_progress).toBe('completed')
  })

  it('cede el control al gestor al terminar la ayuda', () => {
    expect(VOLUNTEER_NEXT_STAGE.completed).toBeNull()
    expect(awaitsValidation('completed')).toBe(true)
    expect(awaitsValidation('in_progress')).toBe(false)
  })

  it('cierra la misión en los estados terminales', () => {
    expect(isExecutionActive('in_progress')).toBe(true)
    expect(isExecutionActive('completed')).toBe(true)
    for (const status of ['verified', 'archived', 'rejected', 'cancelled'] as MissionAssignmentStatus[]) {
      expect(isExecutionActive(status)).toBe(false)
    }
  })
})

describe('progreso', () => {
  it('avanza de forma monótona por el camino feliz', () => {
    const values = MISSION_EXECUTION_STAGES.map((stage) => executionProgress(stage))
    expect(values[0]).toBe(0)
    expect(values.at(-1)).toBe(100)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })

  it('deja en cero las etapas fuera del camino', () => {
    expect(executionProgress('rejected')).toBe(0)
    expect(executionProgress('cancelled')).toBe(0)
  })
})

describe('lenguaje visible', () => {
  it('traduce cada estado de asignación al español', () => {
    const statuses: MissionAssignmentStatus[] = [
      'assigned', 'accepted', 'preparing', 'en_route', 'on_site',
      'in_progress', 'completed', 'verified', 'rejected', 'cancelled', 'archived',
    ]
    for (const status of statuses) {
      expect(MISSION_EXECUTION_LABELS[status]).toBeTruthy()
      expect(MISSION_EXECUTION_LABELS[status]).not.toBe(status)
    }
  })

  it('da un botón en español a cada etapa accionable por el voluntario', () => {
    for (const [status, next] of Object.entries(VOLUNTEER_NEXT_STAGE)) {
      if (next === null) continue
      expect(MISSION_EXECUTION_ACTION_LABELS[status]).toBeTruthy()
    }
  })
})
