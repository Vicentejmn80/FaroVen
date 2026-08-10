import { supabase } from '@/lib/supabase'
import { asOptionalUuid } from '@/lib/utils'
import type { CaseAssignment, CaseDomain, CaseDomainEvent } from '@/domain/case-lifecycle.types'
import type { CaseAssignmentRow, CaseEventRow, CaseRow } from '@/types/supabase'
import { caseAssignmentRowToDomain, caseDomainToRow, caseEventRowToDomain, caseRowToDomain } from './mappers'
import type { PipelineStage } from '@/domain/case-lifecycle.types'

export interface CaseFilters {
  stage?: PipelineStage
  stages?: PipelineStage[]
  priority?: string
  zone?: string
  assignedTo?: string
  search?: string
  limit?: number
  offset?: number
}

export interface CreateCaseInput {
  title: string
  description?: string
  priority?: string
  pipelineStage?: PipelineStage
  location?: { lat: number; lng: number; address?: string }
  zone: string
  affectedCount?: number
  reporterInfo?: { name?: string; phone?: string; email?: string; relationship?: string }
  category?: string
  itemId?: string
  requestSource?: import('@/domain/case-lifecycle.types').RequestSource
  requestType?: import('@/domain/case-lifecycle.types').RequestType
  operationType?: import('@/domain/case-lifecycle.types').OperationType
  metadata?: Record<string, unknown>
}

export interface CreateEventInput {
  caseId: string
  eventType: string
  fromStage?: string
  toStage?: string
  actorId?: string
  comment?: string
  metadata?: Record<string, unknown>
}

export class CaseRepository {
  async list(filters?: CaseFilters): Promise<CaseDomain[]> {
    let query = supabase.from('cases').select('*')

    if (filters?.stage) {
      query = query.eq('pipeline_stage', filters.stage)
    }

    if (filters?.stages && filters.stages.length > 0) {
      query = query.in('pipeline_stage', filters.stages)
    }

    if (filters?.priority) {
      query = query.eq('priority', filters.priority)
    }

    if (filters?.zone) {
      query = query.eq('zone', filters.zone)
    }

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo)
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit ?? 20) - 1)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      // Tabla aún no migrada / sin permisos: no tumbar el hub
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return []
      }
      throw error
    }
    return ((data ?? []) as CaseRow[]).map(caseRowToDomain)
  }

  async findById(id: string): Promise<CaseDomain | null> {
    const { data, error } = await supabase.from('cases').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? caseRowToDomain(data as CaseRow) : null
  }

  async count(filters?: CaseFilters): Promise<number> {
    let query = supabase.from('cases').select('*', { count: 'exact', head: true })
    if (filters?.stage) query = query.eq('pipeline_stage', filters.stage)
    if (filters?.priority) query = query.eq('priority', filters.priority)
    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  }

  async create(input: CreateCaseInput): Promise<CaseDomain> {
    const row: Record<string, unknown> = {
      title: input.title,
      description: input.description ?? '',
      priority: input.priority ?? 'medium',
      pipeline_stage: input.pipelineStage ?? 'nuevo',
      zone: input.zone,
      affected_count: input.affectedCount ?? 1,
      latitude: input.location?.lat ?? null,
      longitude: input.location?.lng ?? null,
      address: input.location?.address ?? null,
      reporter_name: input.reporterInfo?.name ?? null,
      reporter_phone: input.reporterInfo?.phone ?? null,
      reporter_email: input.reporterInfo?.email ?? null,
      reporter_relationship: input.reporterInfo?.relationship ?? null,
      category: input.category ?? null,
      item_id: input.itemId ?? null,
      request_source: input.requestSource ?? 'manual',
      request_type: input.requestType ?? 'manual_request',
      operation_type: input.operationType ?? 'incident',
      metadata: input.metadata ?? {},
    }

    const { data, error } = await supabase.from('cases').insert(row).select('*').single()
    if (error) throw error
    return caseRowToDomain(data as CaseRow)
  }

  /** Creación/enriquecimiento atómico desde reporte (SECURITY DEFINER, evita RLS 42501). */
  async createFromReportRpc(input: {
    reportId: string
    title: string
    description: string
    priority: CaseDomain['priority']
    zone: string
    location: { lat: number; lng: number; address?: string }
    category: string
    itemId?: string | null
    affectedCount: number
    reporterInfo?: CaseDomain['reporterInfo']
    requestSource?: string
    requestType?: string
    operationType?: string
    wizardMetadata?: Record<string, unknown>
  }): Promise<CaseDomain> {
    const { data, error } = await supabase.rpc('create_operational_case_from_report', {
      p_report_id: input.reportId,
      p_title: input.title,
      p_description: input.description,
      p_priority: input.priority,
      p_zone: input.zone,
      p_latitude: input.location.lat,
      p_longitude: input.location.lng,
      p_address: input.location.address ?? null,
      p_category: input.category,
      p_affected_count: input.affectedCount,
      p_item_id: input.itemId ?? null,
      p_reporter_name: input.reporterInfo?.name ?? null,
      p_reporter_phone: input.reporterInfo?.phone ?? null,
      p_reporter_email: input.reporterInfo?.email ?? null,
      p_request_source: input.requestSource ?? 'citizen',
      p_request_type: input.requestType ?? 'report',
      p_operation_type: input.operationType ?? 'incident',
      p_wizard_metadata: input.wizardMetadata ?? null,
    })
    if (error) throw error
    return caseRowToDomain(data as CaseRow)
  }

  async update(id: string, input: Partial<CaseDomain>): Promise<CaseDomain> {
    const row = caseDomainToRow(input)
    const { data, error } = await supabase.from('cases').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return caseRowToDomain(data as CaseRow)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('cases').delete().eq('id', id)
    if (error) throw error
  }

  /** Borrado completo vía RPC (gestor): misiones, necesidades, postulaciones y caso. */
  async deletePermanently(id: string): Promise<void> {
    const { error } = await supabase.rpc('delete_operational_case', { p_case_id: id })
    if (error) throw error
  }

  async addEvent(input: CreateEventInput): Promise<CaseDomainEvent> {
    const { data, error } = await supabase
      .from('case_events')
      .insert({
        case_id: input.caseId,
        event_type: input.eventType,
        from_stage: input.fromStage ?? null,
        to_stage: input.toStage ?? null,
        // '' no es UUID: PostgREST responde 400 y corta el approve a mitad.
        actor_id: asOptionalUuid(input.actorId) ?? null,
        comment: input.comment ?? null,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single()
    if (error) throw error
    return caseEventRowToDomain(data as CaseEventRow)
  }

  async listEvents(caseId: string): Promise<CaseDomainEvent[]> {
    const { data, error } = await supabase
      .from('case_events')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as CaseEventRow[]).map(caseEventRowToDomain)
  }

  async createAssignment(input: {
    caseId: string
    centerId: string
    assignedBy: string
    assignedTo?: string
    reason?: string
  }): Promise<CaseAssignment> {
    const { data, error } = await supabase
      .from('case_assignments')
      .insert({
        case_id: input.caseId,
        center_id: input.centerId,
        assigned_by: input.assignedBy,
        assigned_to: input.assignedTo ?? null,
        reason: input.reason ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return caseAssignmentRowToDomain(data as CaseAssignmentRow)
  }

  async listAssignments(caseId: string): Promise<CaseAssignment[]> {
    const { data, error } = await supabase
      .from('case_assignments')
      .select('*')
      .eq('case_id', caseId)
      .order('assigned_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as CaseAssignmentRow[]).map(caseAssignmentRowToDomain)
  }

  async listByCenter(centerId: string): Promise<CaseDomain[]> {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('assigned_center_id', centerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as CaseRow[]).map(caseRowToDomain)
  }

  async countActiveByCenter(centerId: string): Promise<number> {
    const { count, error } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_center_id', centerId)
      .not('pipeline_stage', 'in', '("resolved","archived")')
    if (error) throw error
    return count ?? 0
  }

  async updateAssignment(id: string, input: Partial<CaseAssignment>): Promise<CaseAssignment> {
    const row: Record<string, unknown> = {}
    if (input.status) row.status = input.status
    if (input.acceptedAt) row.accepted_at = input.acceptedAt.toISOString()
    if (input.rejectedAt) row.rejected_at = input.rejectedAt.toISOString()
    if (input.reason !== undefined) row.reason = input.reason ?? null

    const { data, error } = await supabase.from('case_assignments').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return caseAssignmentRowToDomain(data as CaseAssignmentRow)
  }
}

export const caseRepository = new CaseRepository()
