import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PersonSearchResult } from '@/lib/types'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'

interface SearchParams {
  first_name?: string
  last_name?: string
}

async function searchPerson(params: SearchParams): Promise<PersonSearchResult[]> {
  const { data, error } = await supabase.rpc('search_person', {
    p_first_name: params.first_name || null,
    p_last_name: params.last_name || null,
    p_limit: 20,
  })

  if (error) throw error
  return data ?? []
}

export function useSearch(params: SearchParams) {
  const hasQuery = (params.first_name?.length ?? 0) >= 2 || (params.last_name?.length ?? 0) >= 2

  return useQuery({
    queryKey: ['search', params],
    queryFn: () => searchPerson(params),
    enabled: hasQuery,
    staleTime: 60_000,
    retry: 1,
  })
}
