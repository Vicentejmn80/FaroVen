import { supabase } from '@/lib/supabase'
import type { Mission, MissionAssignment, MissionEvent, MissionStage, MissionEventType } from '@/domain/mission.types'
import type { MissionRow, MissionAssignmentRow, MissionEventRow } from '@/types/supabase'

function mapMissionRow(row: MissionRow): Mission {
  return {
    id: row.id,
    supportRequestId: row.support_request_id ?? undefined,
    caseId: row.case_id ?? undefined,
    centerId: row.center_id,
    title: row.title,
    description: row.description,
    priority: row.priority as Mission['priority'],
    requiredSkills: row.required_skills,
    requiredPeople: row.required_people,
    assignedPeople: row.assigned_people,
    status: row.status as MissionStage,
    location: { lat: row.latitude, lng: row.longitude, address: row.address ?? undefined, zone: row.zone },
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    eta: row.eta ? new Date(row.eta) : undefined,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
  }
}

function missionDomainToRow(domain: Partial<Mission>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (domain.title !== undefined) row.title = domain.title
  if (domain.description !== undefined) row.description = domain.description
  if (domain.priority !== undefined) row.priority = domain.priority
  if (domain.status !== undefined) row.status = domain.status
  if (domain.assignedPeople !== undefined) row.assigned_people = domain.assignedPeople
  if (domain.requiredSkills !== undefined) row.required_skills = domain.requiredSkills
  if (domain.requiredPeople !== undefined) row.required_people = domain.requiredPeople
  if (domain.eta !== undefined) row.eta = domain.eta?.toISOString() ?? null
  if (domain.deadline !== undefined) row.deadline = domain.deadline?.toISOString() ?? null
  if (domain.completedAt !== undefined) row.completed_at = domain.completedAt?.toISOString() ?? null
  if (domain.verifiedAt !== undefined) row.verified_at = domain.verifiedAt?.toISOString() ?? null
  if (domain.cancelledAt !== undefined) row.cancelled_at = domain.cancelledAt?.toISOString() ?? null
  if (domain.cancellationReason !== undefined) row.cancellation_reason = domain.cancellationReason ?? null
  if (domain.updatedAt !== undefined) row.updated_at = domain.updatedAt.toISOString()
  return row
}

function mapMissionAssignmentRow(row: MissionAssignmentRow): MissionAssignment {
  return {
    id: row.id,
    missionId: row.mission_id,
    volunteerId: row.volunteer_id,
    status: row.status as MissionAssignment['status'],
    assignedAt: new Date(row.assigned_at),
    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
    arrivedAt: row.arrived_at ? new Date(row.arrived_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    rating: row.rating ?? undefined,
    feedback: row.feedback ?? undefined,
  }
}

function mapMissionEventRow(row: MissionEventRow): MissionEvent {
  return {
    id: row.id,
    missionId: row.mission_id,
    eventType: row.event_type as MissionEventType,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    description: row.description ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

export interface MissionFilters {
  status?: MissionStage
  statuses?: MissionStage[]
  centerId?: string
  zone?: string
  priority?: string
  limit?: number
  offset?: number
}

export class MissionRepository {
  async list(filters?: MissionFilters): Promise<Mission[]> {
    let query = supabase.from('missions').select('*')

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses)
    }
    if (filters?.centerId) {
      query = query.eq('center_id', filters.centerId)
    }
    if (filters?.zone) {
      query = query.eq('zone', filters.zone)
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority)
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit ?? 20) - 1)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as MissionRow[]).map(mapMissionRow)
  }

  async findById(id: string): Promise<Mission | null> {
    const { data, error } = await supabase.from('missions').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? mapMissionRow(data as MissionRow) : null
  }

  async create(input: {
    centerId: string
    title: string
    description?: string
    priority?: string
    requiredSkills: string[]
    requiredPeople: number
    location: { lat: number; lng: number; address?: string; zone?: string }
    supportRequestId?: string
    caseId?: string
    deadline?: Date
    createdBy: string
  }): Promise<Mission> {
    const { data, error } = await supabase
      .from('missions')
      .insert({
        center_id: input.centerId,
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? 'medium',
        required_skills: input.requiredSkills,
        required_people: input.requiredPeople,
        lat: input.location.lat,
        lng: input.location.lng,
        address: input.location.address ?? null,
        zone: input.location.zone ?? '',
        support_request_id: input.supportRequestId ?? null,
        case_id: input.caseId ?? null,
        deadline: input.deadline?.toISOString() ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapMissionRow(data as MissionRow)
  }

  async update(id: string, input: Partial<Mission>): Promise<Mission> {
    const row = missionDomainToRow(input)
    const { data, error } = await supabase.from('missions').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return mapMissionRow(data as MissionRow)
  }

  async addEvent(input: {
    missionId: string
    eventType: string
    actorId?: string
    actorName?: string
    description?: string
    metadata?: Record<string, unknown>
  }): Promise<MissionEvent> {
    const { data, error } = await supabase
      .from('mission_events')
      .insert({
        mission_id: input.missionId,
        event_type: input.eventType,
        actor_id: input.actorId ?? null,
        actor_name: input.actorName ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapMissionEventRow(data as MissionEventRow)
  }

  async listEvents(missionId: string): Promise<MissionEvent[]> {
    const { data, error } = await supabase
      .from('mission_events')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as MissionEventRow[]).map(mapMissionEventRow)
  }

  async listAssignments(missionId: string): Promise<MissionAssignment[]> {
    const { data, error } = await supabase
      .from('mission_assignments')
      .select('*')
      .eq('mission_id', missionId)
      .order('assigned_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as MissionAssignmentRow[]).map(mapMissionAssignmentRow)
  }

  async createAssignment(input: {
    missionId: string
    volunteerId: string
  }): Promise<MissionAssignment> {
    const { data, error } = await supabase
      .from('mission_assignments')
      .insert({
        mission_id: input.missionId,
        volunteer_id: input.volunteerId,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapMissionAssignmentRow(data as MissionAssignmentRow)
  }

  async updateAssignment(id: string, input: Partial<MissionAssignment>): Promise<MissionAssignment> {
    const row: Record<string, unknown> = {}
    if (input.status) row.status = input.status
    if (input.respondedAt) row.responded_at = input.respondedAt.toISOString()
    if (input.arrivedAt) row.arrived_at = input.arrivedAt.toISOString()
    if (input.completedAt) row.completed_at = input.completedAt.toISOString()
    if (input.rating !== undefined) row.rating = input.rating
    if (input.feedback !== undefined) row.feedback = input.feedback

    const { data, error } = await supabase
      .from('mission_assignments')
      .update(row)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return mapMissionAssignmentRow(data as MissionAssignmentRow)
  }

  async listAssignmentsByVolunteer(volunteerId: string): Promise<MissionAssignment[]> {
    const { data, error } = await supabase
      .from('mission_assignments')
      .select('*')
      .eq('volunteer_id', volunteerId)
      .order('assigned_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as MissionAssignmentRow[]).map(mapMissionAssignmentRow)
  }
}

export const missionRepository = new MissionRepository()
