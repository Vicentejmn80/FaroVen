import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STAGES,
  CASE_EVENT_TYPES,
  ALL_PIPELINE_STAGES,
  type CaseDomain,
} from '../case-lifecycle.types'
import {
  isValidTransition,
  getValidTargets,
  getTransitionEvent,
  canTransition,
  transitionCase,
  isTerminalStage,
  isActiveStage,
  calculateSlaDeadline,
  isSlaBreached,
  calculateSlaProgress,
} from '../case-lifecycle.service'

function makeCase(overrides?: Partial<CaseDomain>): CaseDomain {
  return {
    id: 'test-001',
    title: 'Caso de prueba',
    description: 'Descripción del caso de prueba',
    priority: 'high',
    pipelineStage: PIPELINE_STAGES.NUEVO,
    location: { lat: 10.5, lng: -66.9 },
    zone: 'Centro',
    affectedCount: 1,
    reporterInfo: { name: 'Test', phone: '0412-0000000' },
    createdAt: new Date('2026-07-16T10:00:00Z'),
    updatedAt: new Date('2026-07-16T10:00:00Z'),
    ...overrides,
  }
}

const N = PIPELINE_STAGES

/* ------------------------------------------------------------------ */
/*  isValidTransition                                                  */
/* ------------------------------------------------------------------ */
describe('isValidTransition', () => {
  it('permite nuevo → pending_review', () => {
    expect(isValidTransition(N.NUEVO, N.PENDING_REVIEW)).toBe(true)
  })

  it('permite nuevo → archived', () => {
    expect(isValidTransition(N.NUEVO, N.ARCHIVED)).toBe(true)
  })

  it('permite pending_review → validating', () => {
    expect(isValidTransition(N.PENDING_REVIEW, N.VALIDATING)).toBe(true)
  })

  it('permite pending_review → awaiting_info', () => {
    expect(isValidTransition(N.PENDING_REVIEW, N.AWAITING_INFO)).toBe(true)
  })

  it('permite pending_review → archived', () => {
    expect(isValidTransition(N.PENDING_REVIEW, N.ARCHIVED)).toBe(true)
  })

  it('permite validating → assigned', () => {
    expect(isValidTransition(N.VALIDATING, N.ASSIGNED)).toBe(true)
  })

  it('permite validating → awaiting_info', () => {
    expect(isValidTransition(N.VALIDATING, N.AWAITING_INFO)).toBe(true)
  })

  it('permite awaiting_info → pending_review', () => {
    expect(isValidTransition(N.AWAITING_INFO, N.PENDING_REVIEW)).toBe(true)
  })

  it('permite awaiting_info → archived', () => {
    expect(isValidTransition(N.AWAITING_INFO, N.ARCHIVED)).toBe(true)
  })

  it('permite assigned → accepted', () => {
    expect(isValidTransition(N.ASSIGNED, N.ACCEPTED)).toBe(true)
  })

  it('permite assigned → pending_review', () => {
    expect(isValidTransition(N.ASSIGNED, N.PENDING_REVIEW)).toBe(true)
  })

  it('permite accepted → in_attention', () => {
    expect(isValidTransition(N.ACCEPTED, N.IN_ATTENTION)).toBe(true)
  })

  it('permite in_attention → resolved', () => {
    expect(isValidTransition(N.IN_ATTENTION, N.RESOLVED)).toBe(true)
  })

  it('permite in_attention → awaiting_info', () => {
    expect(isValidTransition(N.IN_ATTENTION, N.AWAITING_INFO)).toBe(true)
  })

  it('permite resolved → archived', () => {
    expect(isValidTransition(N.RESOLVED, N.ARCHIVED)).toBe(true)
  })

  it('permite resolved → in_attention (reabrir)', () => {
    expect(isValidTransition(N.RESOLVED, N.IN_ATTENTION)).toBe(true)
  })

  it('NO permite saltos inválidos (nuevo → accepted)', () => {
    expect(isValidTransition(N.NUEVO, N.ACCEPTED)).toBe(false)
  })

  it('NO permite saltos inválidos (nuevo → resolved)', () => {
    expect(isValidTransition(N.NUEVO, N.RESOLVED)).toBe(false)
  })

  it('NO permite saltos inválidos (archived → cualquier sitio)', () => {
    for (const s of ALL_PIPELINE_STAGES) {
      expect(isValidTransition(N.ARCHIVED, s)).toBe(false)
    }
  })

  it('NO permite saltos inválidos (resolved → validating)', () => {
    expect(isValidTransition(N.RESOLVED, N.VALIDATING)).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  getValidTargets                                                    */
/* ------------------------------------------------------------------ */
describe('getValidTargets', () => {
  it('nuevo targets son pending_review y archived', () => {
    const targets = getValidTargets(N.NUEVO)
    expect(targets).toContain(N.PENDING_REVIEW)
    expect(targets).toContain(N.ARCHIVED)
    expect(targets).toHaveLength(2)
  })

  it('archived no tiene targets válidos', () => {
    expect(getValidTargets(N.ARCHIVED)).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/*  getTransitionEvent                                                 */
/* ------------------------------------------------------------------ */
describe('getTransitionEvent', () => {
  it('nuevo → pending_review emite CASE_SUBMITTED', () => {
    expect(getTransitionEvent(N.NUEVO, N.PENDING_REVIEW)).toBe(CASE_EVENT_TYPES.CASE_SUBMITTED)
  })

  it('nuevo → archived emite CASE_DISMISSED', () => {
    expect(getTransitionEvent(N.NUEVO, N.ARCHIVED)).toBe(CASE_EVENT_TYPES.CASE_DISMISSED)
  })

  it('pending_review → validating emite CASE_REVIEW_STARTED', () => {
    expect(getTransitionEvent(N.PENDING_REVIEW, N.VALIDATING)).toBe(CASE_EVENT_TYPES.CASE_REVIEW_STARTED)
  })

  it('assigned → accepted emite CASE_ACCEPTED', () => {
    expect(getTransitionEvent(N.ASSIGNED, N.ACCEPTED)).toBe(CASE_EVENT_TYPES.CASE_ACCEPTED)
  })

  it('in_attention → resolved emite CASE_RESOLVED', () => {
    expect(getTransitionEvent(N.IN_ATTENTION, N.RESOLVED)).toBe(CASE_EVENT_TYPES.CASE_RESOLVED)
  })

  it('resolved → in_attention emite CASE_REOPENED', () => {
    expect(getTransitionEvent(N.RESOLVED, N.IN_ATTENTION)).toBe(CASE_EVENT_TYPES.CASE_REOPENED)
  })

  it('transición no mapeada retorna null', () => {
    expect(getTransitionEvent(N.ARCHIVED, N.NUEVO)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/*  canTransition                                                      */
/* ------------------------------------------------------------------ */
describe('canTransition', () => {
  it('transición válida → { allowed: true }', () => {
    const c = makeCase()
    expect(canTransition(c, N.PENDING_REVIEW)).toEqual({ allowed: true })
  })

  it('mismo estado → { allowed: false, reason }', () => {
    const c = makeCase()
    const result = canTransition(c, N.NUEVO)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('transición inválida → { allowed: false, reason }', () => {
    const c = makeCase({ pipelineStage: N.NUEVO })
    const result = canTransition(c, N.RESOLVED)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('No se puede transicionar')
  })
})

/* ------------------------------------------------------------------ */
/*  transitionCase                                                     */
/* ------------------------------------------------------------------ */
describe('transitionCase', () => {
  it('actualiza pipelineStage y updatedAt', () => {
    const c = makeCase()
    const { case: result, event } = transitionCase(c, N.PENDING_REVIEW)
    expect(result.pipelineStage).toBe(N.PENDING_REVIEW)
    expect(result.updatedAt.getTime()).toBeGreaterThan(c.updatedAt.getTime())
    expect(event.toStage).toBe(N.PENDING_REVIEW)
  })

  it('emite evento con tipo correcto', () => {
    const c = makeCase()
    const { event } = transitionCase(c, N.PENDING_REVIEW)
    expect(event.eventType).toBe(CASE_EVENT_TYPES.CASE_SUBMITTED)
    expect(event.fromStage).toBe(N.NUEVO)
    expect(event.toStage).toBe(N.PENDING_REVIEW)
  })

  it('lanza error para transición inválida', () => {
    const c = makeCase({ pipelineStage: N.NUEVO })
    expect(() => transitionCase(c, N.RESOLVED)).toThrow()
  })

  it('lanza error para mismo estado', () => {
    const c = makeCase()
    expect(() => transitionCase(c, N.NUEVO)).toThrow()
  })

  it('asigna actorId y comment al evento', () => {
    const c = makeCase()
    const { event } = transitionCase(c, N.PENDING_REVIEW, 'user-001', 'Iniciando revisión')
    expect(event.actorId).toBe('user-001')
    expect(event.comment).toBe('Iniciando revisión')
  })

  it('asigna firstResponseAt al llegar a in_attention', () => {
    const c = makeCase({ pipelineStage: N.ACCEPTED })
    const { case: result } = transitionCase(c, N.IN_ATTENTION, 'user-001')
    expect(result.firstResponseAt).toBeDefined()
  })

  it('no sobreescribe firstResponseAt si ya existe', () => {
    const existing = new Date('2026-07-16T08:00:00Z')
    const c = makeCase({ pipelineStage: N.ACCEPTED, firstResponseAt: existing })
    const { case: result } = transitionCase(c, N.IN_ATTENTION, 'user-001')
    expect(result.firstResponseAt).toBe(existing)
  })

  it('asigna resolvedAt al llegar a resolved', () => {
    const c = makeCase({ pipelineStage: N.IN_ATTENTION })
    const { case: result } = transitionCase(c, N.RESOLVED)
    expect(result.resolvedAt).toBeDefined()
  })

  it('limpia resolvedAt al reabrir', () => {
    const c = makeCase({ pipelineStage: N.RESOLVED, resolvedAt: new Date() })
    const { case: result } = transitionCase(c, N.IN_ATTENTION)
    expect(result.resolvedAt).toBeUndefined()
  })

  it('asigna assignedAt al llegar a assigned', () => {
    const c = makeCase({ pipelineStage: N.VALIDATING })
    const { case: result } = transitionCase(c, N.ASSIGNED)
    expect(result.assignedAt).toBeDefined()
  })

  it('no sobreescribe assignedAt si ya existe', () => {
    const existing = new Date('2026-07-16T09:00:00Z')
    const c = makeCase({ pipelineStage: N.VALIDATING, assignedAt: existing })
    const { case: result } = transitionCase(c, N.ASSIGNED)
    expect(result.assignedAt).toBe(existing)
  })

  it('recorre pipeline completo sin errores', () => {
    let c = makeCase()
    const stages: Array<{ from: string; to: string }> = [
      { from: N.NUEVO, to: N.PENDING_REVIEW },
      { from: N.PENDING_REVIEW, to: N.VALIDATING },
      { from: N.VALIDATING, to: N.ASSIGNED },
      { from: N.ASSIGNED, to: N.ACCEPTED },
      { from: N.ACCEPTED, to: N.IN_ATTENTION },
      { from: N.IN_ATTENTION, to: N.RESOLVED },
      { from: N.RESOLVED, to: N.ARCHIVED },
    ]
    for (const s of stages) {
      const result = transitionCase(c, s.to as any)
      expect(result.case.pipelineStage).toBe(s.to)
      expect(result.event.fromStage).toBe(s.from)
      expect(result.event.toStage).toBe(s.to)
      c = result.case
    }
    expect(c.pipelineStage).toBe(N.ARCHIVED)
    expect(c.resolvedAt).toBeDefined()
  })
})

/* ------------------------------------------------------------------ */
/*  isTerminalStage / isActiveStage                                    */
/* ------------------------------------------------------------------ */
describe('stage helpers', () => {
  it('archived es terminal', () => {
    expect(isTerminalStage(N.ARCHIVED)).toBe(true)
  })

  it('nuevo no es terminal', () => {
    expect(isTerminalStage(N.NUEVO)).toBe(false)
  })

  it('nuevo es activo', () => {
    expect(isActiveStage(N.NUEVO)).toBe(true)
  })

  it('resolved no es activo', () => {
    expect(isActiveStage(N.RESOLVED)).toBe(false)
  })

  it('archived no es activo', () => {
    expect(isActiveStage(N.ARCHIVED)).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  SLA helpers                                                        */
/* ------------------------------------------------------------------ */
describe('SLA helpers', () => {
  it('calculateSlaDeadline da 2h para critical', () => {
    const base = new Date('2026-07-16T10:00:00Z')
    const deadline = calculateSlaDeadline('critical', base)
    expect(deadline.getTime() - base.getTime()).toBe(2 * 60 * 60 * 1000)
  })

  it('calculateSlaDeadline da 8h para high', () => {
    const base = new Date('2026-07-16T10:00:00Z')
    const deadline = calculateSlaDeadline('high', base)
    expect(deadline.getTime() - base.getTime()).toBe(8 * 60 * 60 * 1000)
  })

  it('calculateSlaDeadline da 24h para medium', () => {
    const base = new Date('2026-07-16T10:00:00Z')
    const deadline = calculateSlaDeadline('medium', base)
    expect(deadline.getTime() - base.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('calculateSlaDeadline da 72h para low', () => {
    const base = new Date('2026-07-16T10:00:00Z')
    const deadline = calculateSlaDeadline('low', base)
    expect(deadline.getTime() - base.getTime()).toBe(72 * 60 * 60 * 1000)
  })

  it('isSlaBreached retorna false para fecha futura', () => {
    const future = new Date(Date.now() + 3600000)
    expect(isSlaBreached(future)).toBe(false)
  })

  it('isSlaBreached retorna true para fecha pasada', () => {
    const past = new Date(Date.now() - 3600000)
    expect(isSlaBreached(past)).toBe(true)
  })

  it('calculateSlaProgress retorna 0 al inicio', () => {
    const now = new Date()
    const deadline = new Date(now.getTime() + 3600000)
    expect(calculateSlaProgress(now, deadline)).toBeCloseTo(0, 0)
  })

  it('calculateSlaProgress retorna 1 cuando deadline pasó', () => {
    const past = new Date(Date.now() - 7200000)
    const deadline = new Date(Date.now() - 3600000)
    expect(calculateSlaProgress(past, deadline)).toBe(1)
  })
})
