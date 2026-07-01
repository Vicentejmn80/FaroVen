import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CoordinatorSiteType, Hospital, Shelter, SupplyCenter } from '@/lib/types'

export interface RegistrySite {
  id: string
  type: CoordinatorSiteType
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
}

async function fetchSitesRegistry(): Promise<RegistrySite[]> {
  const [hospitalsRes, supplyRes, sheltersRes] = await Promise.all([
    supabase.from('hospitals').select('id, name, address, latitude, longitude').eq('status', 'active').order('name'),
    supabase.from('supply_centers').select('id, name, address, latitude, longitude').eq('status', 'active').order('name'),
    supabase.from('shelters').select('id, name, address, latitude, longitude').eq('status', 'active').order('name'),
  ])

  if (hospitalsRes.error) throw hospitalsRes.error
  if (supplyRes.error) throw supplyRes.error
  if (sheltersRes.error) throw sheltersRes.error

  return [
    ...(hospitalsRes.data as Pick<Hospital, 'id' | 'name' | 'address' | 'latitude' | 'longitude'>[]).map((h) => ({
      id: h.id,
      type: 'hospital' as const,
      name: h.name,
      address: h.address,
      latitude: h.latitude,
      longitude: h.longitude,
    })),
    ...(supplyRes.data as Pick<SupplyCenter, 'id' | 'name' | 'address' | 'latitude' | 'longitude'>[]).map((c) => ({
      id: c.id,
      type: 'supply_center' as const,
      name: c.name,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
    })),
    ...(sheltersRes.data as Pick<Shelter, 'id' | 'name' | 'address' | 'latitude' | 'longitude'>[]).map((s) => ({
      id: s.id,
      type: 'shelter' as const,
      name: s.name,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
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
