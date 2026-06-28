import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CoordinatorSiteType, Hospital, SupplyCenter } from '@/lib/types'

export interface RegistrySite {
  id: string
  type: CoordinatorSiteType
  name: string
}

async function fetchSitesRegistry(): Promise<RegistrySite[]> {
  const [hospitalsRes, supplyRes] = await Promise.all([
    supabase.from('hospitals').select('id, name').eq('status', 'active').order('name'),
    supabase.from('supply_centers').select('id, name').eq('status', 'active').order('name'),
  ])

  if (hospitalsRes.error) throw hospitalsRes.error
  if (supplyRes.error) throw supplyRes.error

  return [
    ...(hospitalsRes.data as Pick<Hospital, 'id' | 'name'>[]).map((h) => ({
      id: h.id,
      type: 'hospital' as const,
      name: h.name,
    })),
    ...(supplyRes.data as Pick<SupplyCenter, 'id' | 'name'>[]).map((c) => ({
      id: c.id,
      type: 'supply_center' as const,
      name: c.name,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function useSitesRegistry() {
  return useQuery({
    queryKey: ['sites-registry'],
    queryFn: fetchSitesRegistry,
    staleTime: 120_000,
  })
}
