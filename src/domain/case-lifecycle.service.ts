import {
  PIPELINE_STAGES,
  VALID_TRANSITIONS,
  TRANSITION_TO_EVENT,
  transitionKey,
  CASE_EVENT_TYPES,
  type PipelineStage,
  type CasePriority,
  type CaseDomain,
  type CaseDomainEvent,
  type CaseEventType,
  type TransitionResult,
} from './case-lifecycle.types'

export function isValidTransition(from: PipelineStage, to: PipelineStage): boolean {
  const allowed = VALID_TRANSITIONS[from]
  return allowed.includes(to)
}

export function getValidTargets(stage: PipelineStage): readonly PipelineStage[] {
  return VALID_TRANSITIONS[stage]
}

export function getTransitionEvent(from: PipelineStage, to: PipelineStage): CaseEventType | null {
  const key = transitionKey(from, to)
  return (TRANSITION_TO_EVENT[key] ?? null) as CaseEventType | null
}

export function canTransition(
  caseData: CaseDomain,
  toStage: PipelineStage,
): { allowed: boolean; reason?: string } {
  if (caseData.pipelineStage === toStage) {
    return { allowed: false, reason: 'El caso ya se encuentra en ese estado' }
  }

  if (!isValidTransition(caseData.pipelineStage, toStage)) {
    const validStages = getValidTargets(caseData.pipelineStage)
    const stageNames = validStages.map((s) => `"${s}"`).join(', ')
    return {
      allowed: false,
      reason: `No se puede transicionar de "${caseData.pipelineStage}" a "${toStage}". Estados válidos: ${stageNames}`,
    }
  }

  return { allowed: true }
}

export function transitionCase(
  caseData: CaseDomain,
  toStage: PipelineStage,
  actorId?: string,
  comment?: string,
): TransitionResult {
  const check = canTransition(caseData, toStage)
  if (!check.allowed) {
    throw new Error(check.reason)
  }

  const eventType = getTransitionEvent(caseData.pipelineStage, toStage) ?? CASE_EVENT_TYPES.CASE_SUBMITTED
  const now = new Date()

  const event: CaseDomainEvent = {
    id: crypto.randomUUID(),
    caseId: caseData.id,
    eventType,
    fromStage: caseData.pipelineStage,
    toStage,
    actorId,
    comment,
    createdAt: now,
  }

  const updatedCase: CaseDomain = {
    ...caseData,
    pipelineStage: toStage,
    updatedAt: now,
    firstResponseAt: caseData.firstResponseAt ?? (toStage === PIPELINE_STAGES.IN_ATTENTION ? now : undefined),
    resolvedAt: toStage === PIPELINE_STAGES.RESOLVED ? now : toStage === PIPELINE_STAGES.IN_ATTENTION ? undefined : caseData.resolvedAt,
  }

  if (toStage === PIPELINE_STAGES.ASSIGNED && !updatedCase.assignedAt) {
    updatedCase.assignedAt = now
  }

  return { case: updatedCase, event }
}

export function isTerminalStage(stage: PipelineStage): boolean {
  return stage === PIPELINE_STAGES.ARCHIVED
}

export function isActiveStage(stage: PipelineStage): boolean {
  return !isTerminalStage(stage) && stage !== PIPELINE_STAGES.RESOLVED
}

export function calculateSlaDeadline(priority: CasePriority, from: Date = new Date()): Date {
  const hours: Record<CasePriority, number> = {
    critical: 2,
    high: 8,
    medium: 24,
    low: 72,
  }
  return new Date(from.getTime() + hours[priority] * 60 * 60 * 1000)
}

export function isSlaBreached(deadline: Date): boolean {
  return new Date() > deadline
}

export function calculateSlaProgress(createdAt: Date, deadline: Date): number {
  const now = new Date()
  const total = deadline.getTime() - createdAt.getTime()
  const elapsed = now.getTime() - createdAt.getTime()
  if (total <= 0) return 1
  return Math.min(1, Math.max(0, elapsed / total))
}
