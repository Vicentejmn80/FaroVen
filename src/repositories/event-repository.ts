import type { Event } from '@/domain/models'
import { supabase } from '@/lib/supabase'
import type { EventRow } from '@/types/supabase'
import { eventRowToEvent } from './mappers'

import type { RegisterSiteType } from './types'

export class EventRepository {
  async list(): Promise<Event[]> {
    const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as EventRow[]).map(eventRowToEvent)
  }

  async listByCenter(siteType: RegisterSiteType, siteId: string, limit = 50): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('center_type', siteType)
      .eq('center_id', siteId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return ((data ?? []) as EventRow[]).map(eventRowToEvent)
  }
}

export const eventRepository = new EventRepository()
