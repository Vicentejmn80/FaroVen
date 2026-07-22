import { supabase } from '@/lib/supabase'
import { isMissingTableError } from '@/lib/supabase-errors'
import type { AvailabilitySlot } from '@/domain/availability.types'

interface AvailabilityRow {
  id: string
  user_id: string
  date: string
  hour: number
  available: boolean
  created_at: string
  updated_at: string
}

function mapRow(row: AvailabilityRow): AvailabilitySlot {
  return {
    date: row.date,
    hour: row.hour,
    available: row.available,
  }
}

export const availabilityRepository = {
  async loadWeek(userId: string, startDate: string, endDate: string): Promise<AvailabilitySlot[]> {
    const { data, error } = await supabase
      .from('case_manager_availability')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
    return (data ?? []).map(mapRow)
  },

  async upsertSlot(userId: string, date: string, hour: number, available: boolean): Promise<void> {
    const { error } = await supabase.from('case_manager_availability').upsert(
      { user_id: userId, date, hour, available },
      { onConflict: 'user_id, date, hour' },
    )
    if (error) throw error
  },

  async upsertSlots(userId: string, slots: AvailabilitySlot[]): Promise<void> {
    const rows = slots.map((s) => ({
      user_id: userId,
      date: s.date,
      hour: s.hour,
      available: s.available,
    }))

    const { error } = await supabase.from('case_manager_availability').upsert(rows, {
      onConflict: 'user_id, date, hour',
      ignoreDuplicates: false,
    })
    if (error) throw error
  },

  async toggleSlot(userId: string, date: string, hour: number): Promise<boolean> {
    const { data: existing } = await supabase
      .from('case_manager_availability')
      .select('id, available')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('hour', hour)
      .single()

    const newAvailable = existing ? !existing.available : true

    const { error } = await supabase.from('case_manager_availability').upsert(
      { user_id: userId, date, hour, available: newAvailable },
      { onConflict: 'user_id, date, hour' },
    )
    if (error) throw error
    return newAvailable
  },

  async deleteSlot(userId: string, date: string, hour: number): Promise<void> {
    const { error } = await supabase
      .from('case_manager_availability')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)
      .eq('hour', hour)
    if (error) throw error
  },
}
