import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Hospital, Need, SupplyCenter } from '@/lib/types'
import { PRIORITY_LABELS } from '@/lib/types'
import { fetchActiveAnchorSites } from '@/lib/supabase-queries'
import { getFreshnessLevel } from '@/lib/utils'

export interface HelpTarget {
  id: string
  locationName: string
  itemName: string
  priorityLabel: string
  pctCovered: number
  detail: string
}

export interface SaturatedAlert {
  id: string
  locationName: string
  reason: string
  items?: string[]
}

export interface ActionableInsights {
  helpHere: HelpTarget[]
  avoidSaturate: SaturatedAlert[]
}

async function fetchActionableInsights(): Promise<ActionableInsights> {
  const [needsRes, hospitals, supplyCenters] = await Promise.all([
    supabase.from('needs').select('*').order('updated_at', { ascending: false }).limit(40),
    fetchActiveAnchorSites<Hospital>('hospitals'),
    fetchActiveAnchorSites<SupplyCenter>('supply_centers'),
  ])

  if (needsRes.error) throw needsRes.error

  const hospitalsMap = new Map(hospitals.map((h) => [h.id, h]))
  const supplyMap = new Map(supplyCenters.map((c) => [c.id, c]))

  const resolveLocation = (need: Need) => {
    if (need.needable_type === 'hospital') return hospitalsMap.get(need.needable_id)
    if (need.needable_type === 'supply_center') return supplyMap.get(need.needable_id)
    return null
  }

  const freshNeeds = (needsRes.data as Need[]).filter(
    (n) => getFreshnessLevel(n.updated_at) !== 'expired'
  )

  const helpHere: HelpTarget[] = freshNeeds
    .filter(
      (need) =>
        ['critical', 'high'].includes(need.priority) &&
        need.pct_covered < 60 &&
        resolveLocation(need)
    )
    .map((need) => {
      const location = resolveLocation(need)!
      return {
        id: need.id,
        locationName: location.name,
        itemName: need.item_name,
        priorityLabel: PRIORITY_LABELS[need.priority],
        pctCovered: need.pct_covered,
        detail: `${need.qty_received}/${need.qty_required} ${need.unit}`,
      }
    })
    .slice(0, 4)

  const needSaturation: SaturatedAlert[] = freshNeeds
    .filter((need) => need.pct_covered >= 90 && resolveLocation(need))
    .map((need) => {
      const location = resolveLocation(need)!
      return {
        id: `need-${need.id}`,
        locationName: location.name,
        reason: `${need.item_name} reportado al ${need.pct_covered}% (${need.qty_received}/${need.qty_required}).`,
        items: [need.item_name],
      }
    })

  const supplyAlerts: SaturatedAlert[] = supplyCenters
    .filter((c) => (c.not_accepts?.length ?? 0) > 0)
    .map((c) => ({
      id: `supply-${c.id}`,
      locationName: c.name,
      reason: 'El coordinador del acopio reporta exceso en estos insumos.',
      items: c.not_accepts ?? undefined,
    }))

  const avoidSaturate = [...needSaturation, ...supplyAlerts].slice(0, 6)

  return { helpHere, avoidSaturate }
}

export function useActionableInsights() {
  return useQuery({
    queryKey: ['actionable-insights'],
    queryFn: fetchActionableInsights,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
