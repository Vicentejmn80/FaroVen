import { supabase } from '@/lib/supabase'

export interface ItemsCatalogSearchResult {
  itemId: string
  key: string
  canonicalName: string
  unit: string
  status: 'active' | 'pending_review' | 'archived' | 'rejected'
  matchKind: string
  matchScore: number
}

export class ItemsCatalogRepository {
  async search(input: {
    query: string
    limit?: number
    includePending?: boolean
  }): Promise<ItemsCatalogSearchResult[]> {
    const q = input.query.trim()
    if (!q) return []
    const { data, error } = await supabase.rpc('search_items_catalog', {
      p_query: q,
      p_limit: input.limit ?? 12,
      p_include_pending: Boolean(input.includePending),
    })
    if (error) throw error
    const rows = (data ?? []) as Array<{
      item_id: string
      item_key: string
      canonical_name: string
      unit: string
      status: string
      match_kind: string
      match_score: number
    }>
    return rows.map((r) => ({
      itemId: r.item_id,
      key: r.item_key,
      canonicalName: r.canonical_name,
      unit: r.unit,
      status: (r.status as ItemsCatalogSearchResult['status']) ?? 'active',
      matchKind: r.match_kind,
      matchScore: Number(r.match_score ?? 0),
    }))
  }
}

export const itemsCatalogRepository = new ItemsCatalogRepository()

