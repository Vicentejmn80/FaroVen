import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-provider'
import type { CoordinatorProfile, CoordinatorSiteType } from '@/lib/types'

async function fetchSiteName(siteType: CoordinatorSiteType, siteId: string): Promise<string> {
  const table = siteType === 'hospital' ? 'hospitals' : 'supply_centers'
  const { data, error } = await supabase.from(table).select('name').eq('id', siteId).maybeSingle()
  if (error) throw error
  return data?.name ?? 'Sitio sin nombre'
}

async function fetchCoordinatorProfile(authUserId: string): Promise<CoordinatorProfile | null> {
  const { data, error } = await supabase
    .from('coordinator_profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const profile = data as CoordinatorProfile
  const site_name = await fetchSiteName(profile.site_type, profile.site_id)
  return { ...profile, site_name }
}

export interface SaveCoordinatorSiteInput {
  site_type: CoordinatorSiteType
  site_id?: string
  new_site_name?: string
}

async function saveCoordinatorSite(
  authUserId: string,
  input: SaveCoordinatorSiteInput
): Promise<CoordinatorProfile> {
  let siteId = input.site_id

  if (!siteId) {
    const name = input.new_site_name?.trim()
    if (!name) throw new Error('Indica el nombre del sitio')

    const table = input.site_type === 'hospital' ? 'hospitals' : 'supply_centers'
    const { data: created, error: createError } = await supabase
      .from(table)
      .insert({ name, status: 'active', is_anchor: true })
      .select('id')
      .single()

    if (createError) throw createError
    siteId = created.id
  }

  const { data: existing } = await supabase
    .from('coordinator_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const payload = {
    auth_user_id: authUserId,
    site_type: input.site_type,
    site_id: siteId,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('coordinator_profiles')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    const site_name = await fetchSiteName(data.site_type, data.site_id)
    return { ...(data as CoordinatorProfile), site_name }
  }

  const { data, error } = await supabase.from('coordinator_profiles').insert(payload).select('*').single()
  if (error) throw error
  const site_name = await fetchSiteName(data.site_type, data.site_id)
  return { ...(data as CoordinatorProfile), site_name }
}

export function useCoordinatorProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['coordinator-profile', user?.id],
    queryFn: () => fetchCoordinatorProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })
}

export function useSaveCoordinatorSite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveCoordinatorSiteInput) => {
      if (!user?.id) throw new Error('Sesión requerida')
      return saveCoordinatorSite(user.id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator-profile'] })
      queryClient.invalidateQueries({ queryKey: ['sites-registry'] })
      queryClient.invalidateQueries({ queryKey: ['anchor-sites'] })
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
      queryClient.invalidateQueries({ queryKey: ['supply-centers'] })
    },
  })
}
