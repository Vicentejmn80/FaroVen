import {
  listAllProfiles,
  setUserRole,
  setParticipationIntent,
  type DevProfileRow,
} from '@/repositories/dev-repository'
import type { FaroRole } from '@/lib/roles'

export type { DevProfileRow }

export const PARTICIPATION_INTENT_LABELS: Record<string, string> = {
  need_help: 'Necesito ayuda',
  want_to_help: 'Quiero ayudar',
  represent_org: 'Represento una organización',
}

export const ROLE_LABELS: Record<FaroRole, string> = {
  public: 'Ciudadano',
  volunteer: 'Voluntario',
  case_manager: 'Gestor de Casos',
  coordinator: 'Coordinador',
  regional_admin: 'Administrador Regional',
  super_admin: 'Super Administrador',
}

export const ALL_ROLES: FaroRole[] = [
  'public',
  'volunteer',
  'case_manager',
  'coordinator',
  'regional_admin',
  'super_admin',
]

export async function searchProfiles(search?: string): Promise<DevProfileRow[]> {
  return listAllProfiles(search)
}

export async function changeUserRole(
  userId: string,
  newRole: FaroRole,
  reason?: string,
): Promise<DevProfileRow> {
  return setUserRole(userId, newRole, reason)
}

export async function changeParticipationIntent(
  userId: string,
  intent: 'need_help' | 'want_to_help' | 'represent_org' | null,
): Promise<DevProfileRow> {
  return setParticipationIntent(userId, intent)
}
