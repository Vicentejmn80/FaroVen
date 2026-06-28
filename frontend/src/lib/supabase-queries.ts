import { supabase } from '@/lib/supabase'

type SiteTable = 'hospitals' | 'shelters' | 'supply_centers'

export async function fetchActiveAnchorSites<T>(table: SiteTable): Promise<T[]> {
  const anchored = await supabase
    .from(table)
    .select('*')
    .eq('status', 'active')
    .eq('is_anchor', true)
    .order('name')

  if (!anchored.error && anchored.data) {
    return anchored.data as T[]
  }

  const fallback = await supabase.from(table).select('*').eq('status', 'active').order('name').limit(10)
  if (fallback.error) throw fallback.error
  return (fallback.data ?? []) as T[]
}
