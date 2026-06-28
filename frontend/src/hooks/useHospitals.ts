import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Hospital } from '@/lib/types'

async function fetchHospitals(): Promise<Hospital[]> {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return data ?? []
}

async function fetchHospital(id: string): Promise<Hospital> {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export function useHospitals() {
  return useQuery({
    queryKey: ['hospitals'],
    queryFn: fetchHospitals,
    staleTime: 120_000,
  })
}

export function useHospital(id: string) {
  return useQuery({
    queryKey: ['hospital', id],
    queryFn: () => fetchHospital(id),
    enabled: !!id,
    staleTime: 120_000,
  })
}
