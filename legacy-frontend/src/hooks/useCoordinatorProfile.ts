import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-provider'
import type { CoordinatorProfile, CoordinatorSiteType } from '@/lib/types'

async function fetchSiteName(siteType: CoordinatorSiteType, siteId: string): Promise<string> {
  const table =
    siteType === 'hospital' ? 'hospitals' : siteType === 'supply_center' ? 'supply_centers' : 'shelters'
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
  new_site_address?: string
  new_site_latitude?: number
  new_site_longitude?: number
  full_name?: string
  phone?: string
  role_title?: string
  organization?: string
  city_zone?: string
  responsibilities?: string
  onboarding_complete?: boolean
}

function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const msg = String((err as { message?: string }).message ?? '').toLowerCase()
  return msg.includes('column') && msg.includes('does not exist')
}

async function saveCoordinatorSite(
  authUserId: string,
  input: SaveCoordinatorSiteInput
): Promise<CoordinatorProfile> {
  let siteId = input.site_id

  if (!siteId) {
    const name = input.new_site_name?.trim()
    if (!name) throw new Error('Indica el nombre del sitio')
    const address = input.new_site_address?.trim() || null

    const table =
      input.site_type === 'hospital'
        ? 'hospitals'
        : input.site_type === 'supply_center'
          ? 'supply_centers'
          : 'shelters'
    const { data: created, error: createError } = await supabase
      .from(table)
      .insert({
        name,
        address,
        latitude: input.new_site_latitude ?? null,
        longitude: input.new_site_longitude ?? null,
        status: 'active',
        is_anchor: true,
      })
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
    full_name: input.full_name?.trim() || null,
    phone: input.phone?.trim() || null,
    role_title: input.role_title?.trim() || null,
    organization: input.organization?.trim() || null,
    city_zone: input.city_zone?.trim() || null,
    responsibilities: input.responsibilities?.trim() || null,
    onboarding_complete: input.onboarding_complete ?? false,
    updated_at: new Date().toISOString(),
  }

  const legacyPayload = {
    auth_user_id: authUserId,
    site_type: input.site_type,
    site_id: siteId,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    let result = await supabase.from('coordinator_profiles').update(payload).eq('id', existing.id).select('*').single()

    // Compatibilidad: si aún no corrió la migración de hardening, cae a payload legacy.
    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from('coordinator_profiles')
        .update(legacyPayload)
        .eq('id', existing.id)
        .select('*')
        .single()
    }

    if (result.error) throw result.error
    const site_name = await fetchSiteName(result.data.site_type, result.data.site_id)
    return { ...(result.data as CoordinatorProfile), site_name }
  }

  let inserted = await supabase.from('coordinator_profiles').insert(payload).select('*').single()

  if (inserted.error && isMissingColumnError(inserted.error)) {
    inserted = await supabase.from('coordinator_profiles').insert(legacyPayload).select('*').single()
  }

  if (inserted.error) throw inserted.error
  const site_name = await fetchSiteName(inserted.data.site_type, inserted.data.site_id)
  return { ...(inserted.data as CoordinatorProfile), site_name }
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
      queryClient.invalidateQueries({ queryKey: ['shelters'] })
    },
  })
}
