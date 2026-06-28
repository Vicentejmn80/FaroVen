import { useQuery } from '@tanstack/react-query'
import type { Hospital, Shelter, SupplyCenter } from '@/lib/types'
import { fetchActiveAnchorSites } from '@/lib/supabase-queries'

export interface AnchorLocation {
  id: string
  type: 'hospital' | 'shelter' | 'supply_center'
  name: string
}

async function fetchAnchorSites() {
  const [hospitals, shelters, supplyCenters] = await Promise.all([
    fetchActiveAnchorSites<Hospital>('hospitals'),
    fetchActiveAnchorSites<Shelter>('shelters'),
    fetchActiveAnchorSites<SupplyCenter>('supply_centers'),
  ])
  const locations: AnchorLocation[] = [
    ...hospitals.map((h) => ({
      id: h.id,
      type: 'hospital' as const,
      name: h.name,
    })),
    ...shelters.map((s) => ({
      id: s.id,
      type: 'shelter' as const,
      name: s.name,
    })),
    ...supplyCenters.map((c) => ({
      id: c.id,
      type: 'supply_center' as const,
      name: c.name,
    })),
  ]

  const anchorIds = {
    hospital: new Set(locations.filter((l) => l.type === 'hospital').map((l) => l.id)),
    shelter: new Set(locations.filter((l) => l.type === 'shelter').map((l) => l.id)),
    supply_center: new Set(locations.filter((l) => l.type === 'supply_center').map((l) => l.id)),
  }

  return { locations, anchorIds, hospitals, shelters, supplyCenters }
}

export function useAnchorSites() {
  return useQuery({
    queryKey: ['anchor-sites'],
    queryFn: fetchAnchorSites,
    staleTime: 120_000,
  })
}
