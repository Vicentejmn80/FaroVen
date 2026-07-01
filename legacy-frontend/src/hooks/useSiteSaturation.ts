import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'

async function fetchSiteNotAccepts(siteType: 'supply_center', siteId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('supply_centers')
    .select('not_accepts')
    .eq('id', siteId)
    .single()

  if (error) throw error
  return data?.not_accepts ?? []
}

function parseItems(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function saveNotAccepts(siteId: string, items: string[]): Promise<void> {
  const { error } = await supabase
    .from('supply_centers')
    .update({
      not_accepts: items.length > 0 ? items : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId)

  if (error) throw error
}

export function useSiteSaturation() {
  const { data: profile } = useCoordinatorProfile()
  const siteId = profile?.site_type === 'supply_center' ? profile.site_id : undefined

  return useQuery({
    queryKey: ['site-saturation', siteId],
    queryFn: () => fetchSiteNotAccepts('supply_center', siteId!),
    enabled: !!siteId,
  })
}

export function useUpdateSiteSaturation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ siteId, itemsText }: { siteId: string; itemsText: string }) =>
      saveNotAccepts(siteId, parseItems(itemsText)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-saturation'] })
      queryClient.invalidateQueries({ queryKey: ['supply-centers'] })
      queryClient.invalidateQueries({ queryKey: ['actionable-insights'] })
    },
  })
}

export { parseItems }
