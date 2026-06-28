import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SupplyCenter } from '@/lib/types'

async function fetchSupplyCenters(): Promise<SupplyCenter[]> {
  const { data, error } = await supabase
    .from('supply_centers')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return data ?? []
}

export function useSupplyCenters() {
  return useQuery({
    queryKey: ['supply-centers'],
    queryFn: fetchSupplyCenters,
    staleTime: 120_000,
  })
}
