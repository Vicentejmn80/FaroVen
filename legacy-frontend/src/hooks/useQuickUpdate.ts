import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CoordinatorSiteType, Need, NeedPriority, NeedWithLocation } from '@/lib/types'

export interface QuickUpdateInput {
  needable_type: CoordinatorSiteType
  needable_id: string
  item_name: string
  priority: NeedPriority
  qty_required: number
  qty_received: number
  unit: string
  notes?: string
  existing_need_id?: string
}

async function fetchNeedsForLocation(type: string, id: string): Promise<Need[]> {
  const { data, error } = await supabase
    .from('needs')
    .select('*')
    .eq('needable_type', type)
    .eq('needable_id', id)
    .order('priority', { ascending: true })

  if (error) throw error
  return data ?? []
}

async function saveQuickUpdate(input: QuickUpdateInput): Promise<void> {
  const payload = {
    needable_type: input.needable_type,
    needable_id: input.needable_id,
    item_name: input.item_name,
    priority: input.priority,
    qty_required: input.qty_required,
    qty_received: input.qty_received,
    unit: input.unit,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  }

  if (input.existing_need_id) {
    const { error } = await supabase.from('needs').update(payload).eq('id', input.existing_need_id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('needs').insert(payload)
  if (error) throw error
}

export function useLocationNeeds(type: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ['location-needs', type, id],
    queryFn: () => fetchNeedsForLocation(type!, id!),
    enabled: !!type && !!id,
  })
}

export function useQuickUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveQuickUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['needs'] })
      queryClient.invalidateQueries({ queryKey: ['location-needs'] })
      queryClient.invalidateQueries({ queryKey: ['home-feed'] })
      queryClient.invalidateQueries({ queryKey: ['actionable-insights'] })
    },
  })
}

async function fetchNeedsWithLocations(): Promise<NeedWithLocation[]> {
  const [needsRes, hospitalsRes, supplyRes] = await Promise.all([
    supabase.from('needs').select('*').order('priority', { ascending: true }).order('updated_at', { ascending: false }),
    supabase.from('hospitals').select('id, name'),
    supabase.from('supply_centers').select('id, name'),
  ])

  if (needsRes.error) throw needsRes.error
  if (hospitalsRes.error) throw hospitalsRes.error
  if (supplyRes.error) throw supplyRes.error

  const hospitals = new Map((hospitalsRes.data ?? []).map((h) => [h.id, h.name]))
  const supplyCenters = new Map((supplyRes.data ?? []).map((c) => [c.id, c.name]))

  return (needsRes.data as Need[]).map((need) => {
    let location_name = 'Sitio'
    let location_type: NeedWithLocation['location_type'] = 'hospital'

    if (need.needable_type === 'hospital') {
      location_name = hospitals.get(need.needable_id) ?? location_name
      location_type = 'hospital'
    } else if (need.needable_type === 'supply_center') {
      location_name = supplyCenters.get(need.needable_id) ?? location_name
      location_type = 'supply_center'
    } else if (need.needable_type === 'shelter') {
      location_type = 'shelter'
    }

    return { ...need, location_name, location_type }
  })
}

export function useNeedsWithLocations() {
  return useQuery({
    queryKey: ['needs'],
    queryFn: fetchNeedsWithLocations,
    staleTime: 60_000,
  })
}
