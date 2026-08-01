import { useQuery } from '@tanstack/react-query'
import { itemsCatalogRepository } from '@/repositories/items-catalog-repository'

export function useItemsCatalogSearch(query: string, opts?: { limit?: number; includePending?: boolean }) {
  const q = query.trim()
  return useQuery({
    queryKey: ['items-catalog-search', q, opts?.limit ?? 12, Boolean(opts?.includePending)],
    queryFn: () => itemsCatalogRepository.search({ query: q, limit: opts?.limit, includePending: opts?.includePending }),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}

