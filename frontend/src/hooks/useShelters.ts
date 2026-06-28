import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Shelter } from '@/lib/types'

async function fetchShelters(): Promise<Shelter[]> {
  const { data, error } = await supabase
    .from('shelters')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return data ?? []
}

async function fetchShelter(id: string): Promise<Shelter> {
  const { data, error } = await supabase
    .from('shelters')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export function useShelters() {
  return useQuery({
    queryKey: ['shelters'],
    queryFn: fetchShelters,
    staleTime: 120_000,
  })
}

export function useShelter(id: string) {
  return useQuery({
    queryKey: ['shelter', id],
    queryFn: () => fetchShelter(id),
    enabled: !!id,
    staleTime: 120_000,
  })
}
