import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RegisterSiteType } from '@/repositories/types'
import { FARO_QUERY_KEYS } from './query-keys'

export interface SiteSaturationEntry {
  needKey: string
  needLabel: string
  level: 'low' | 'medium' | 'high' | 'critical'
  updatedAt: string | null
}

async function fetchSiteSaturation(siteType: RegisterSiteType, siteId: string): Promise<SiteSaturationEntry[]> {
  const { data, error } = await supabase
    .from('site_saturation')
    .select('need_key, need_label, level, updated_at')
    .eq('site_type', siteType)
    .eq('site_id', siteId)
    .order('need_label', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    needKey: String(row.need_key),
    needLabel: String(row.need_label),
    level: row.level as SiteSaturationEntry['level'],
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }))
}

export function useSiteSaturation(siteType?: RegisterSiteType, siteId?: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.siteSaturation, siteType, siteId],
    queryFn: () => fetchSiteSaturation(siteType!, siteId!),
    enabled: Boolean(siteType && siteId),
  })
}
