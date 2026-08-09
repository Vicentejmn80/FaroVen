import { transitionCase, canTransition } from '@/domain/case-lifecycle.service'
import type {
  CaseDomain,
  CaseDomainEvent,
  CasePriority,
  OperationType,
  PipelineStage,
  RequestSource,
  RequestType,
  TransitionResult,
} from '@/domain/case-lifecycle.types'
import { caseRepository, type CaseFilters } from '@/repositories/case-repository'
import { operationalLog, pipelineLog } from '@/lib/operational-log'
import { assertCaseReadyToPublish } from '@/domain/case-publish-validation'
import { supabase } from '@/lib/supabase'

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
  /** Origen del caso (evita duplicar al reintentar convertir el mismo reporte). */
  reportId?: string
  requestSource?: RequestSource
  requestType?: RequestType
  operationType?: OperationType
  /** Centro que solicita (coordinador / transferencia). */
  requestingCenterId?: string
  /** Centro origen con stock (transferencia). */
  originCenterId?: string
  /** Si true, valida coords/categoría/prioridad/cantidad antes de crear. */
  requirePublishReady?: boolean
  /** Destino / responsable para validación de publicación. */
  destination?: string
  responsibleId?: string
}

export const caseService = {
  async create(params: CreateCaseParams): Promise<TransitionResult> {
    const requestSource = params.requestSource ?? (params.reportId ? 'citizen' : 'manual')
    const requestType = params.requestType ?? (params.reportId ? 'report' : 'manual_request')
    const operationType = params.operationType ?? 'incident'

    if (params.requirePublishReady) {
      assertCaseReadyToPublish({
        location: params.location,
        category: params.category,
        priority: params.priority,
        quantity: params.affectedCount,
        responsibleId: params.responsibleId ?? params.actorId,
        destination: params.destination ?? params.zone,
      })
    }

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
      requestSource,
      requestType,
      operationType,
      metadata: {
        ...(params.reportId ? { report_id: params.reportId } : {}),
        ...(params.requestingCenterId ? { requesting_center_id: params.requestingCenterId } : {}),
        ...(params.originCenterId ? { origin_center_id: params.originCenterId } : {}),
      },
    })

    const domain: CaseDomain = {
      ...caseData,
      priority: (params.priority ?? caseData.priority) as CasePriority,
      pipelineStage: 'nuevo',
    }

    // Evento de ingreso — el caso permanece en NUEVO hasta que el GC abra revisión.
    await caseRepository.addEvent({
      caseId: domain.id,
      eventType: 'case_submitted',
      toStage: 'nuevo',
      actorId: params.actorId,
      comment:
        params.priority === 'critical'
          ? 'Caso crítico recibido — pendiente de revisión'
          : 'Solicitud operativa recibida',
    })

    pipelineLog('request_created', {
      entityId: domain.id,
      actorId: params.actorId,
      to: 'nuevo',
      payload: {
        requestSource,
        requestType,
        operationType,
        category: params.category,
        reportId: params.reportId,
      },
    })

    return {
      case: domain,
      event: {
        id: crypto.randomUUID(),
        caseId: domain.id,
        eventType: 'case_submitted' as const,
        toStage: 'nuevo' as PipelineStage,
        actorId: params.actorId,
        createdAt: new Date(),
      },
    }
  },

  /** Gestor abre el caso: Nuevo → En revisión. */
  async startReview(caseId: string, actorId?: string): Promise<TransitionResult> {
    const existing = await caseRepository.findById(caseId)
    if (!existing) throw new Error(`Caso no encontrado: ${caseId}`)
    if (existing.pipelineStage !== 'nuevo') {
      return {
        case: existing,
        event: {
          id: crypto.randomUUID(),
          caseId,
          eventType: 'case_review_started',
          fromStage: existing.pipelineStage,
          toStage: existing.pipelineStage,
          actorId,
          createdAt: new Date(),
        },
      }
    }
    return caseService.transition(
      caseId,
      'pending_review',
      actorId,
      'Revisión iniciada por el gestor de casos',
    )
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
    if (!check.allowed) {
      operationalLog({
        entityType: 'case',
        entityId: caseId,
        action: 'transition_rejected',
        from: domain.pipelineStage,
        to: toStage,
        actorId: actorId ?? null,
        source: 'service',
        error: check.reason,
      })
      throw new Error(check.reason)
    }

    const started = Date.now()
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

    operationalLog({
      entityType: 'case',
      entityId: caseId,
      action: 'transition',
      from: result.event.fromStage,
      to: result.event.toStage,
      actorId: actorId ?? null,
      centerId: result.case.assignedCenterId ?? null,
      source: 'service',
      durationMs: Date.now() - started,
      payload: { eventType: result.event.eventType, comment },
    })

    if (toStage === 'resolved' || toStage === 'archived') {
      pipelineLog('case_resolved', {
        entityId: caseId,
        actorId,
        from: result.event.fromStage,
        to: toStage,
      })
      try {
        const { missionService } = await import('@/services/mission-service')
        await missionService.closeForResolvedCase(caseId, actorId)
      } catch (err) {
        console.warn('[CASE] No se pudo sincronizar misiones al resolver/archivar', err)
        operationalLog({
          entityType: 'case',
          entityId: caseId,
          action: 'close_missions_failed',
          from: result.event.fromStage,
          to: toStage,
          actorId: actorId ?? null,
          source: 'service',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return result
  },

  async updateClassification(
    caseId: string,
    patch: Partial<Pick<CaseDomain, 'operationType' | 'requestType' | 'category' | 'affectedCount'>>,
  ): Promise<CaseDomain> {
    return caseRepository.update(caseId, patch)
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
    const existing = await caseRepository.findById(caseId)
    if (!existing) throw new Error(`Caso no encontrado: ${caseId}`)
    if (existing.pipelineStage !== 'resolved') {
      throw new Error('Solo se puede archivar un caso ya resuelto (tras validación).')
    }

    // Garantizar Success Case si la validación no lo creó
    try {
      const { data: existingSuccess } = await supabase
        .from('success_cases')
        .select('id')
        .eq('case_id', caseId)
        .limit(1)
        .maybeSingle()
      if (!existingSuccess) {
        await supabase.from('success_cases').insert({
          case_id: caseId,
          title: existing.title,
          category: existing.category ?? 'humanitarian',
          zone: existing.zone,
          help_type: 'humanitarian',
          collaborator_type: 'system',
          impact_summary: existing.description ?? existing.title,
          public_code: `FARO-${new Date().getFullYear()}-${caseId.slice(0, 6).toUpperCase()}`,
          verified_by: actorId ?? null,
          verified_at: new Date().toISOString(),
        })
      }
    } catch {
      console.warn('[CASE] No se pudo asegurar Success Case al archivar', caseId)
    }

    return caseService.transition(caseId, 'archived', actorId, comment)
  },

  async deletePermanently(caseId: string): Promise<void> {
    return caseRepository.deletePermanently(caseId)
  },
}
