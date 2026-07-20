import { describe, it, expect } from 'vitest'
import {
  MISSION_STAGES,
  MISSION_EVENT_TYPES,
  ALL_MISSION_STAGES,
  type Mission,
} from '../mission.types'
import {
  isValidMissionTransition,
  getValidMissionTargets,
  getMissionTransitionEvent,
  canTransitionMission,
  transitionMission,
  isTerminalMissionStage,
  isActiveMissionStage,
  calculateMissionProgress,
  canAssignVolunteers,
  hasRequiredPeople,
} from '../mission.service'

const S = MISSION_STAGES

function makeMission(overrides?: Partial<Mission>): Mission {
  return {
    id: 'mission-001',
    title: 'Misión de prueba',
    description: 'Apoyo médico en zona afectada',
    priority: 'high',
    requiredSkills: ['paramedic', 'driver'],
    requiredPeople: 2,
    assignedPeople: 0,
    status: S.CREATED,
    centerId: 'center-001',
    location: { lat: 10.5, lng: -66.9, zone: 'Centro' },
    createdBy: 'coord-001',
    createdAt: new Date('2026-07-17T10:00:00Z'),
    updatedAt: new Date('2026-07-17T10:00:00Z'),
    ...overrides,
  }
}

describe('isValidMissionTransition', () => {
  it('permite created → matching', () => {
    expect(isValidMissionTransition(S.CREATED, S.MATCHING)).toBe(true)
  })

  it('permite created → archived', () => {
    expect(isValidMissionTransition(S.CREATED, S.ARCHIVED)).toBe(true)
  })

  it('permite matching → assigned', () => {
    expect(isValidMissionTransition(S.MATCHING, S.ASSIGNED)).toBe(true)
  })

  it('permite matching → created', () => {
    expect(isValidMissionTransition(S.MATCHING, S.CREATED)).toBe(true)
  })

  it('permite matching → archived', () => {
    expect(isValidMissionTransition(S.MATCHING, S.ARCHIVED)).toBe(true)
  })

  it('permite assigned → accepted', () => {
    expect(isValidMissionTransition(S.ASSIGNED, S.ACCEPTED)).toBe(true)
  })

  it('permite assigned → matching (fallback)', () => {
    expect(isValidMissionTransition(S.ASSIGNED, S.MATCHING)).toBe(true)
  })

  it('permite assigned → cancelled', () => {
    expect(isValidMissionTransition(S.ASSIGNED, S.CANCELLED)).toBe(true)
  })

  it('permite accepted → en_route', () => {
    expect(isValidMissionTransition(S.ACCEPTED, S.EN_ROUTE)).toBe(true)
  })

  it('permite accepted → cancelled', () => {
    expect(isValidMissionTransition(S.ACCEPTED, S.CANCELLED)).toBe(true)
  })

  it('permite en_route → on_site', () => {
    expect(isValidMissionTransition(S.EN_ROUTE, S.ON_SITE)).toBe(true)
  })

  it('permite en_route → accepted (replanificar)', () => {
    expect(isValidMissionTransition(S.EN_ROUTE, S.ACCEPTED)).toBe(true)
  })

  it('permite en_route → cancelled', () => {
    expect(isValidMissionTransition(S.EN_ROUTE, S.CANCELLED)).toBe(true)
  })

  it('permite on_site → in_progress', () => {
    expect(isValidMissionTransition(S.ON_SITE, S.IN_PROGRESS)).toBe(true)
  })

  it('permite on_site → en_route (recalcular)', () => {
    expect(isValidMissionTransition(S.ON_SITE, S.EN_ROUTE)).toBe(true)
  })

  it('permite in_progress → completed', () => {
    expect(isValidMissionTransition(S.IN_PROGRESS, S.COMPLETED)).toBe(true)
  })

  it('permite in_progress → on_site (reabrir)', () => {
    expect(isValidMissionTransition(S.IN_PROGRESS, S.ON_SITE)).toBe(true)
  })

  it('permite completed → verified', () => {
    expect(isValidMissionTransition(S.COMPLETED, S.VERIFIED)).toBe(true)
  })

  it('permite completed → in_progress (reabrir)', () => {
    expect(isValidMissionTransition(S.COMPLETED, S.IN_PROGRESS)).toBe(true)
  })

  it('permite verified → archived', () => {
    expect(isValidMissionTransition(S.VERIFIED, S.ARCHIVED)).toBe(true)
  })

  it('permite verified → in_progress (reabrir)', () => {
    expect(isValidMissionTransition(S.VERIFIED, S.IN_PROGRESS)).toBe(true)
  })

  it('NO permite archived → cualquier estado', () => {
    for (const s of ALL_MISSION_STAGES) {
      expect(isValidMissionTransition(S.ARCHIVED, s)).toBe(false)
    }
  })

  it('NO permite created → completed (salto)', () => {
    expect(isValidMissionTransition(S.CREATED, S.COMPLETED)).toBe(false)
  })

  it('NO permite assigned → verified (salto)', () => {
    expect(isValidMissionTransition(S.ASSIGNED, S.VERIFIED)).toBe(false)
  })
})

describe('getValidMissionTargets', () => {
  it('created tiene 2 targets', () => {
    expect(getValidMissionTargets(S.CREATED)).toHaveLength(2)
    expect(getValidMissionTargets(S.CREATED)).toContain(S.MATCHING)
    expect(getValidMissionTargets(S.CREATED)).toContain(S.ARCHIVED)
  })

  it('archived no tiene targets', () => {
    expect(getValidMissionTargets(S.ARCHIVED)).toHaveLength(0)
  })

  it('in_progress tiene 3 targets (completed, on_site, cancelled)', () => {
    expect(getValidMissionTargets(S.IN_PROGRESS)).toHaveLength(3)
  })
})

describe('getMissionTransitionEvent', () => {
  it('created → matching emite MATCHING_COMPLETED', () => {
    expect(getMissionTransitionEvent(S.CREATED, S.MATCHING)).toBe(MISSION_EVENT_TYPES.MATCHING_COMPLETED)
  })

  it('assigned → accepted emite VOLUNTEER_ACCEPTED', () => {
    expect(getMissionTransitionEvent(S.ASSIGNED, S.ACCEPTED)).toBe(MISSION_EVENT_TYPES.VOLUNTEER_ACCEPTED)
  })

  it('in_progress → completed emite MISSION_COMPLETED', () => {
    expect(getMissionTransitionEvent(S.IN_PROGRESS, S.COMPLETED)).toBe(MISSION_EVENT_TYPES.MISSION_COMPLETED)
  })

  it('completed → verified emite MISSION_VERIFIED', () => {
    expect(getMissionTransitionEvent(S.COMPLETED, S.VERIFIED)).toBe(MISSION_EVENT_TYPES.MISSION_VERIFIED)
  })

  it('transición no mapeada retorna null', () => {
    expect(getMissionTransitionEvent(S.ARCHIVED, S.CREATED)).toBeNull()
  })
})

describe('canTransitionMission', () => {
  it('transición válida → { allowed: true }', () => {
    const m = makeMission()
    expect(canTransitionMission(m, S.MATCHING)).toEqual({ allowed: true })
  })

  it('mismo estado → { allowed: false, reason }', () => {
    const m = makeMission()
    const result = canTransitionMission(m, S.CREATED)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('transición inválida → { allowed: false, reason }', () => {
    const m = makeMission()
    const result = canTransitionMission(m, S.COMPLETED)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('No se puede transicionar')
  })
})

describe('transitionMission', () => {
  it('actualiza status y updatedAt', () => {
    const m = makeMission()
    const { mission: result } = transitionMission(m, S.MATCHING)
    expect(result.status).toBe(S.MATCHING)
    expect(result.updatedAt.getTime()).toBeGreaterThan(m.updatedAt.getTime())
    expect(result.status).toBe(S.MATCHING)
  })

  it('emite evento con tipo correcto', () => {
    const m = makeMission()
    const { event } = transitionMission(m, S.MATCHING)
    expect(event.eventType).toBe(MISSION_EVENT_TYPES.MATCHING_COMPLETED)
  })

  it('lanza error para transición inválida', () => {
    const m = makeMission()
    expect(() => transitionMission(m, S.COMPLETED)).toThrow()
  })

  it('lanza error para mismo estado', () => {
    const m = makeMission()
    expect(() => transitionMission(m, S.CREATED)).toThrow()
  })

  it('asigna actorId, actorName y description al evento', () => {
    const m = makeMission()
    const { event } = transitionMission(m, S.MATCHING, 'user-001', 'Sistema', 'Iniciando matching')
    expect(event.actorId).toBe('user-001')
    expect(event.actorName).toBe('Sistema')
    expect(event.description).toBe('Iniciando matching')
  })

  it('asigna completedAt al llegar a completed', () => {
    const m = makeMission({ status: S.IN_PROGRESS })
    const { mission: result } = transitionMission(m, S.COMPLETED)
    expect(result.completedAt).toBeDefined()
  })

  it('limpia completedAt al reabrir', () => {
    const m = makeMission({ status: S.COMPLETED, completedAt: new Date() })
    const { mission: result } = transitionMission(m, S.IN_PROGRESS)
    expect(result.completedAt).toBeUndefined()
  })

  it('asigna verifiedAt al llegar a verified', () => {
    const m = makeMission({ status: S.COMPLETED })
    const { mission: result } = transitionMission(m, S.VERIFIED)
    expect(result.verifiedAt).toBeDefined()
  })

  it('asigna cancelledAt y cancellationReason al cancelar', () => {
    const m = makeMission({ status: S.IN_PROGRESS })
    const { mission: result } = transitionMission(m, S.CANCELLED, 'coord-001', undefined, 'Emergencia cerrada')
    expect(result.cancelledAt).toBeDefined()
    expect(result.cancellationReason).toBe('Emergencia cerrada')
  })

  it('recorre pipeline completo sin errores', () => {
    let m = makeMission()
    const stages: Array<{ from: string; to: string }> = [
      { from: S.CREATED, to: S.MATCHING },
      { from: S.MATCHING, to: S.ASSIGNED },
      { from: S.ASSIGNED, to: S.ACCEPTED },
      { from: S.ACCEPTED, to: S.EN_ROUTE },
      { from: S.EN_ROUTE, to: S.ON_SITE },
      { from: S.ON_SITE, to: S.IN_PROGRESS },
      { from: S.IN_PROGRESS, to: S.COMPLETED },
      { from: S.COMPLETED, to: S.VERIFIED },
      { from: S.VERIFIED, to: S.ARCHIVED },
    ]

    for (const s of stages) {
      const result = transitionMission(m, s.to as any)
      expect(result.mission.status).toBe(s.to)
      m = result.mission
    }

    expect(m.status).toBe(S.ARCHIVED)
    expect(m.completedAt).toBeDefined()
    expect(m.verifiedAt).toBeDefined()
  })
})

describe('helpers', () => {
  it('archived es terminal', () => {
    expect(isTerminalMissionStage(S.ARCHIVED)).toBe(true)
  })

  it('created no es terminal', () => {
    expect(isTerminalMissionStage(S.CREATED)).toBe(false)
  })

  it('created es activo', () => {
    expect(isActiveMissionStage(S.CREATED)).toBe(true)
  })

  it('completed no es activo', () => {
    expect(isActiveMissionStage(S.COMPLETED)).toBe(false)
  })

  it('verified no es activo', () => {
    expect(isActiveMissionStage(S.VERIFIED)).toBe(false)
  })

  it('archived no es activo', () => {
    expect(isActiveMissionStage(S.ARCHIVED)).toBe(false)
  })

  it('canAssignVolunteers solo en matching', () => {
    const m = makeMission()
    expect(canAssignVolunteers({ ...m, status: S.MATCHING })).toBe(true)
    expect(canAssignVolunteers({ ...m, status: S.CREATED })).toBe(false)
    expect(canAssignVolunteers({ ...m, status: S.ASSIGNED })).toBe(false)
  })

  it('hasRequiredPeople compara assigned vs required', () => {
    const m = makeMission({ requiredPeople: 3, assignedPeople: 2 })
    expect(hasRequiredPeople(m)).toBe(false)
    expect(hasRequiredPeople({ ...m, assignedPeople: 3 })).toBe(true)
  })

  it('calculateMissionProgress empieza en 0 y termina en 100', () => {
    expect(calculateMissionProgress(S.CREATED)).toBe(0)
    expect(calculateMissionProgress(S.ARCHIVED)).toBe(100)
  })
})
