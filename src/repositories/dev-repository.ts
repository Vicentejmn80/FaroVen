import { supabase } from '@/lib/supabase'
import type { FaroRole } from '@/lib/roles'

export interface DevProfileRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: FaroRole | null
  status: string
  participation_intent: string | null
  organization_name: string | null
  profession: string | null
  municipality: string | null
  created_at: string
  last_login_at: string | null
  coordinator_site_name: string | null
  coordinator_site_type: string | null
}

export interface SetUserRoleResult {
  success: boolean
  profile?: DevProfileRow
  error?: string
}

function mapProfile(row: Record<string, unknown>): DevProfileRow {
  return {
    id: row.id as string,
    full_name: (row.full_name as string) ?? '',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? null,
    role: (row.role as FaroRole) ?? null,
    status: (row.status as string) ?? 'active',
    participation_intent: (row.participation_intent as string) ?? null,
    organization_name: (row.organization_name as string) ?? null,
    profession: (row.profession as string) ?? null,
    municipality: (row.municipality as string) ?? null,
    created_at: row.created_at as string,
    last_login_at: (row.last_login_at as string) ?? null,
    coordinator_site_name: (row.coordinator_site_name as string) ?? null,
    coordinator_site_type: (row.coordinator_site_type as string) ?? null,
  }
}

export async function listAllProfiles(search?: string): Promise<DevProfileRow[]> {
  const { data, error } = await supabase.rpc('list_all_profiles', {
    p_search: search || null,
  })
  if (error) throw error
  return (data as Record<string, unknown>[]).map(mapProfile)
}

export async function setUserRole(
  userId: string,
  newRole: FaroRole,
  reason?: string,
): Promise<DevProfileRow> {
  const { data, error } = await supabase.rpc('set_user_role', {
    p_user_id: userId,
    p_new_role: newRole,
    p_reason: reason || null,
  })
  if (error) throw error
  return mapProfile(data as Record<string, unknown>)
}

export async function setParticipationIntent(
  userId: string,
  intent: 'need_help' | 'want_to_help' | 'represent_org' | null,
): Promise<DevProfileRow> {
  const { data, error } = await supabase.rpc('set_participation_intent', {
    p_user_id: userId,
    p_intent: intent,
  })
  if (error) throw error
  return mapProfile(data as Record<string, unknown>)
}
