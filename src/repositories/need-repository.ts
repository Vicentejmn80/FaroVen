import type { Need } from '@/domain/models'
import { supabase } from '@/lib/supabase'
import type { NeedRow } from '@/types/supabase'
import { needRowToNeed } from './mappers'
import type { CloseNeedCycleInput, RegisterNeedInput, UpdateNeedInput } from './types'

export class NeedRepository {
  async list(): Promise<Need[]> {
    const { data, error } = await supabase.from('needs').select('*')
    if (error) throw error
    return ((data ?? []) as NeedRow[]).map(needRowToNeed)
  }

  async create(input: RegisterNeedInput): Promise<Need> {
    const { data, error } = await supabase
      .from('needs')
      .insert({
        needable_type: input.needableType,
        needable_id: input.needableId,
        item_name: input.itemName.trim(),
        priority: input.priority,
        qty_required: input.qtyRequired,
        qty_received: input.qtyReceived ?? 0,
        unit: 'unidades',
      })
      .select('*')
      .single()
    if (error) throw error
    return needRowToNeed(data as NeedRow)
  }

  async updateReceived(id: string, qtyReceived: number, notes?: string): Promise<Need> {
    const payload: Record<string, unknown> = { qty_received: qtyReceived }
    if (notes?.trim()) payload.notes = notes.trim()
    const { data, error } = await supabase
      .from('needs')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return needRowToNeed(data as NeedRow)
  }

  async update(input: UpdateNeedInput): Promise<Need> {
    const payload: Record<string, unknown> = {}
    if (input.itemName != null) payload.item_name = input.itemName.trim()
    if (input.priority != null) payload.priority = input.priority
    if (input.qtyRequired != null) payload.qty_required = input.qtyRequired
    if (input.qtyReceived != null) payload.qty_received = input.qtyReceived
    if (input.notes != null) payload.notes = input.notes.trim() || null

    const { data, error } = await supabase
      .from('needs')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw error
    return needRowToNeed(data as NeedRow)
  }

  async markCovered(id: string): Promise<Need> {
    const { data: current, error: readError } = await supabase
      .from('needs')
      .select('qty_required')
      .eq('id', id)
      .single()
    if (readError) throw readError
    const required = (current as { qty_required: number }).qty_required
    return this.updateReceived(id, required)
  }

  async refreshCycles(): Promise<number> {
    const { data, error } = await supabase.rpc('refresh_need_cycles')
    if (error) throw error
    return typeof data === 'number' ? data : 0
  }

  async closeCycle(input: CloseNeedCycleInput): Promise<Need> {
    const { data, error } = await supabase.rpc('close_need_cycle', {
      p_need_id: input.needId,
      p_received_qty: input.receivedQty,
      p_continue: input.continueCycle,
      p_closure_reason: input.closureReason ?? null,
    })
    if (error) throw error
    return needRowToNeed(data as NeedRow)
  }
}

export const needRepository = new NeedRepository()
