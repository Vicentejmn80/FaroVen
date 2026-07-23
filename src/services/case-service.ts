import { transitionCase, canTransition } from '@/domain/case-lifecycle.service'
import type { CaseDomain, CaseDomainEvent, CasePriority, PipelineStage, TransitionResult } from '@/domain/case-lifecycle.types'
import { caseRepository, type CaseFilters } from '@/repositories/case-repository'

export interface CreateCaseParams {
  title: string
  description?: string
  priority?: CasePriority
  zone: string
  location?: { lat: number; lng: number; address?: string }
  affectedCount?: number
  reporterInfo?: { name?: string; phone?: string; email?: string; relationship?: string }
  category?: string
  actorId?: string
}

export const caseService = {
  async create(params: CreateCaseParams): Promise<TransitionResult> {
    const caseData = await caseRepository.create({
      title: params.title,
      description: params.description,
      priority: params.priority,
      pipelineStage: 'nuevo',
      zone: params.zone,
      location: params.location,
      affectedCount: params.affectedCount,
      reporterInfo: params.reporterInfo,
      category: params.category,
    })

    const domain: CaseDomain = {
      ...caseData,
      priority: (params.priority ?? caseData.priority) as CasePriority,
      pipelineStage: caseData.pipelineStage as PipelineStage,
    }

    if (params.priority === 'critical') {
      return caseService.transition(domain.id, 'pending_review', params.actorId, 'Caso crítico — requiere atención inmediata')
    }

    const event: CaseDomainEvent = {
      id: crypto.randomUUID(),
      caseId: caseData.id,
      eventType: 'case_submitted',
      toStage: 'nuevo',
      actorId: params.actorId,
      createdAt: new Date(),
    }

    return { case: domain, event }
  },

  async transition(
    caseId: string,
    toStage: PipelineStage,
    actorId?: string,
    comment?: string,
  ): Promise<TransitionResult> {
    const existing = await caseRepository.findById(caseId)
    if (!existing) throw new Error(`Caso no encontrado: ${caseId}`)

    const domain: CaseDomain = { ...existing, pipelineStage: existing.pipelineStage as PipelineStage }

    const check = canTransition(domain, toStage)
    if (!check.allowed) throw new Error(check.reason)

    const result = transitionCase(domain, toStage, actorId, comment)

    await caseRepository.update(caseId, result.case)

    await caseRepository.addEvent({
      caseId,
      eventType: result.event.eventType,
      fromStage: result.event.fromStage,
      toStage: result.event.toStage,
      actorId,
      comment,
    })

    return result
  },

  async list(filters?: CaseFilters): Promise<CaseDomain[]> {
    return caseRepository.list(filters)
  },

  async getById(id: string): Promise<CaseDomain | null> {
    return caseRepository.findById(id)
  },

  async getTimeline(caseId: string): Promise<CaseDomainEvent[]> {
    return caseRepository.listEvents(caseId)
  },

  async archive(caseId: string, actorId?: string, comment?: string): Promise<TransitionResult> {
    return caseService.transition(caseId, 'archived', actorId, comment)
  },
}
