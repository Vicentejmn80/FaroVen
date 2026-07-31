import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PickupCenterInfo {
  name: string
  address?: string
  contactName?: string
  phone?: string
  schedule?: string
  lat?: number
  lng?: number
}

async function fetchPickupCenterInfo(centerId: string): Promise<PickupCenterInfo | null> {
  for (const table of ['hospitals', 'shelters', 'supply_centers'] as const) {
    const { data } = await supabase
      .from(table)
      .select('name, address, contact_name, phone, contact_phone, schedule, latitude, longitude')
      .eq('id', centerId)
      .maybeSingle()
    if (!data) continue
    const row = data as {
      name: string
      address?: string | null
      contact_name?: string | null
      phone?: string | null
      contact_phone?: string | null
      schedule?: string | null
      latitude?: number | null
      longitude?: number | null
    }
    return {
      name: row.name,
      address: row.address ?? undefined,
      contactName: row.contact_name ?? undefined,
      phone: row.phone ?? row.contact_phone ?? undefined,
      schedule: row.schedule ?? undefined,
      lat: row.latitude ?? undefined,
      lng: row.longitude ?? undefined,
    }
  }
  return null
}

export function usePickupCenterInfo(centerId?: string | null) {
  return useQuery({
    queryKey: ['pickup-center', centerId],
    queryFn: () => fetchPickupCenterInfo(centerId!),
    enabled: Boolean(centerId),
    staleTime: 60_000,
  })
}
