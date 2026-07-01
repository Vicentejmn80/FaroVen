import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReportSiteType } from '@/lib/types'

export interface AdminRegistryRow {
  site_type: ReportSiteType
  site_id: string
  site_name: string
  site_address: string | null
  profile_id: string | null
  auth_user_id: string | null
  coordinator_email: string | null
  coordinator_name: string | null
  is_orphan: boolean
}

async function fetchRegistry(): Promise<AdminRegistryRow[]> {
  const { data, error } = await supabase.rpc('admin_registry_overview')
  if (error) throw error
  return (data ?? []) as AdminRegistryRow[]
}

export function useAdminRegistry() {
  return useQuery({
    queryKey: ['admin-registry'],
    queryFn: fetchRegistry,
    staleTime: 15_000,
  })
}

export function useAdminDeleteSite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteType, siteId }: { siteType: ReportSiteType; siteId: string }) => {
      const { error } = await supabase.rpc('admin_delete_site', {
        p_site_type: siteType,
        p_site_id: siteId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-registry'] })
      queryClient.invalidateQueries({ queryKey: ['sites-registry'] })
      queryClient.invalidateQueries({ queryKey: ['anchor-sites'] })
    },
  })
}

export function useAdminRemoveCoordinator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.rpc('admin_remove_coordinator', {
        p_profile_id: profileId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-registry'] })
    },
  })
}
