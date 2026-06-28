import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Bulletin, BulletinKind, ConfidenceLevel } from '@/lib/types'

export interface CreateBulletinInput {
  kind: BulletinKind
  title: string
  body: string
  source_name: string
  confidence: ConfidenceLevel
}

async function createBulletin(input: CreateBulletinInput): Promise<void> {
  const { error } = await supabase.from('bulletins').insert({
    kind: input.kind,
    title: input.title,
    body: input.body,
    source_name: input.source_name,
    confidence: input.confidence,
    is_published: true,
    published_at: new Date().toISOString(),
  })

  if (error) throw error
}

export function useCreateBulletin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBulletin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-feed'] })
      queryClient.invalidateQueries({ queryKey: ['bulletins'] })
    },
  })
}

export function useBulletins() {
  return useQuery({
    queryKey: ['bulletins'],
    queryFn: async (): Promise<Bulletin[]> => {
      const { data, error } = await supabase
        .from('bulletins')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}
