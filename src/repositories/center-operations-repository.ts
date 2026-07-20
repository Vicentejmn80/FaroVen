import { supabase } from '@/lib/supabase'
import type { CenterResource, CenterEvent, SupportRequest, CenterEventType, SupportRequestStatus, SupportRequestType, OperationalMode } from '@/domain/center-operations.types'
import type { CenterResourceRow, SupportRequestRow, CenterEventRow } from '@/types/supabase'
import type { RegisterSiteType } from './types'

function mapResourceRow(row: CenterResourceRow): CenterResource {
  return {
    id: row.id,
    centerId: row.center_id,
    resourceType: row.resource_type,
    currentLevel: row.current_level,
    maxLevel: row.max_level,
    unit: row.unit,
    updatedAt: new Date(row.updated_at),
  }
}

function mapEventRow(row: CenterEventRow): CenterEvent {
  return {
    id: row.id,
    centerId: row.center_id,
    eventType: row.event_type as CenterEventType,
    previousValue: row.previous_value ?? undefined,
    newValue: row.new_value ?? undefined,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    description: row.description ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

function mapSupportRequestRow(row: SupportRequestRow): SupportRequest {
  return {
    id: row.id,
    centerId: row.center_id,
    requestType: row.request_type as SupportRequestType,
    title: row.title,
    description: row.description ?? undefined,
    urgency: row.urgency as SupportRequest['urgency'],
    quantity: row.quantity,
    durationHours: row.duration_hours ?? undefined,
    status: row.status as SupportRequestStatus,
    createdBy: row.created_by ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function centerTable(siteType: RegisterSiteType): string {
  if (siteType === 'hospital') return 'hospitals'
  if (siteType === 'shelter') return 'shelters'
  return 'supply_centers'
}

export class CenterOperationsRepository {
  async getResources(centerId: string): Promise<CenterResource[]> {
    const { data, error } = await supabase
      .from('center_resources')
      .select('*')
      .eq('center_id', centerId)
      .order('resource_type')
    if (error) throw error
    return ((data ?? []) as CenterResourceRow[]).map(mapResourceRow)
  }

  async upsertResource(input: {
    centerId: string
    resourceType: string
    currentLevel: number
    maxLevel: number
    unit: string
  }): Promise<CenterResource> {
    const { data, error } = await supabase
      .from('center_resources')
      .upsert(
        {
          center_id: input.centerId,
          resource_type: input.resourceType,
          current_level: input.currentLevel,
          max_level: input.maxLevel,
          unit: input.unit,
        },
        { onConflict: 'center_id,resource_type' },
      )
      .select('*')
      .single()
    if (error) throw error
    return mapResourceRow(data as CenterResourceRow)
  }

  async getEvents(centerId: string): Promise<CenterEvent[]> {
    const { data, error } = await supabase
      .from('center_events')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as CenterEventRow[]).map(mapEventRow)
  }

  async createEvent(input: {
    centerId: string
    eventType: string
    previousValue?: string
    newValue?: string
    actorId?: string
    actorName?: string
    description?: string
  }): Promise<CenterEvent> {
    const { data, error } = await supabase
      .from('center_events')
      .insert({
        center_id: input.centerId,
        event_type: input.eventType,
        previous_value: input.previousValue ?? null,
        new_value: input.newValue ?? null,
        actor_id: input.actorId ?? null,
        actor_name: input.actorName ?? null,
        description: input.description ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapEventRow(data as CenterEventRow)
  }

  async getSupportRequests(centerId: string): Promise<SupportRequest[]> {
    const { data, error } = await supabase
      .from('support_requests')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as SupportRequestRow[]).map(mapSupportRequestRow)
  }

  async createSupportRequest(input: {
    centerId: string
    requestType: string
    title: string
    description?: string
    urgency: string
    quantity: number
    durationHours?: number
    createdBy?: string
  }): Promise<SupportRequest> {
    const { data, error } = await supabase
      .from('support_requests')
      .insert({
        center_id: input.centerId,
        request_type: input.requestType,
        title: input.title,
        description: input.description ?? null,
        urgency: input.urgency,
        quantity: input.quantity,
        duration_hours: input.durationHours ?? null,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapSupportRequestRow(data as SupportRequestRow)
  }

  async updateSupportRequest(id: string, input: {
    status?: string
    description?: string
    quantity?: number
    durationHours?: number
  }): Promise<SupportRequest> {
    const payload: Record<string, unknown> = {}
    if (input.status) payload.status = input.status
    if (input.description !== undefined) payload.description = input.description ?? null
    if (input.quantity !== undefined) payload.quantity = input.quantity
    if (input.durationHours !== undefined) payload.duration_hours = input.durationHours ?? null
    payload.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('support_requests')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return mapSupportRequestRow(data as SupportRequestRow)
  }

  async getOperationalMode(centerId: string, siteType: RegisterSiteType): Promise<OperationalMode> {
    const table = centerTable(siteType)
    const { data, error } = await supabase
      .from(table)
      .select('operational_mode')
      .eq('id', centerId)
      .maybeSingle()
    if (error || !data) return 'active'
    return (data as { operational_mode: string }).operational_mode as OperationalMode
  }

  async getOccupancyPct(centerId: string, siteType: RegisterSiteType): Promise<number> {
    const table = centerTable(siteType)
    const { data, error } = await supabase
      .from(table)
      .select('capacity, current_occ')
      .eq('id', centerId)
      .maybeSingle()
    if (error || !data) return 0
    const row = data as { capacity: number | null; current_occ: number | null }
    if (!row.capacity || row.capacity <= 0) return 0
    return Math.min(100, Math.round(((row.current_occ ?? 0) / row.capacity) * 100))
  }

  async updateOperationalMode(centerId: string, siteType: RegisterSiteType, mode: OperationalMode): Promise<void> {
    const table = centerTable(siteType)
    const { error } = await supabase
      .from(table)
      .update({ operational_mode: mode, updated_at: new Date().toISOString() })
      .eq('id', centerId)
    if (error) throw error
  }

  async updateCapacity(centerId: string, siteType: RegisterSiteType, input: {
    current?: number
    total?: number
    adults?: number
    children?: number
    elderly?: number
    disabledMobility?: number
  }): Promise<void> {
    const table = centerTable(siteType)
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.current !== undefined) {
      if (table === 'hospitals') payload.current_occ = input.current
      else if (table === 'shelters') payload.current_occ = input.current
      else payload.current_occ = input.current
    }
    if (input.total !== undefined) payload.capacity = input.total
    if (input.adults !== undefined) payload.occupancy_adults = input.adults
    if (input.children !== undefined) payload.occupancy_children = input.children
    if (input.elderly !== undefined) payload.occupancy_elderly = input.elderly
    if (input.disabledMobility !== undefined) payload.occupancy_disabled_mobility = input.disabledMobility

    const { error } = await supabase.from(table).update(payload).eq('id', centerId)
    if (error) throw error
  }
}

export const centerOpsRepository = new CenterOperationsRepository()
