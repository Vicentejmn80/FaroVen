/** Roles FARO — única fuente de verdad para permisos en frontend. */
export const FARO_ROLES = {
  PUBLIC: 'public',
  COORDINATOR: 'coordinator',
  REGIONAL_ADMIN: 'regional_admin',
  SUPER_ADMIN: 'super_admin',
} as const

export type FaroRole = (typeof FARO_ROLES)[keyof typeof FARO_ROLES]

export const FARO_ROLE_LABELS: Record<FaroRole, string> = {
  [FARO_ROLES.PUBLIC]: 'Ciudadano',
  [FARO_ROLES.COORDINATOR]: 'Coordinador',
  [FARO_ROLES.REGIONAL_ADMIN]: 'Administrador regional',
  [FARO_ROLES.SUPER_ADMIN]: 'Super administrador',
}

export const COORDINATOR_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export type CoordinatorRequestStatus =
  (typeof COORDINATOR_REQUEST_STATUS)[keyof typeof COORDINATOR_REQUEST_STATUS]

export const COORDINATOR_REQUEST_STATUS_LABELS: Record<CoordinatorRequestStatus, string> = {
  [COORDINATOR_REQUEST_STATUS.PENDING]: 'Pendiente',
  [COORDINATOR_REQUEST_STATUS.APPROVED]: 'Aprobada',
  [COORDINATOR_REQUEST_STATUS.REJECTED]: 'Rechazada',
}

export function isElevatedRole(role: FaroRole | null | undefined): boolean {
  return role === FARO_ROLES.COORDINATOR || role === FARO_ROLES.REGIONAL_ADMIN || role === FARO_ROLES.SUPER_ADMIN
}

export function canAccessCoordinatorPanel(role: FaroRole | null | undefined): boolean {
  return role === FARO_ROLES.COORDINATOR
}

export function canAccessAdminPanel(role: FaroRole | null | undefined): boolean {
  return role === FARO_ROLES.REGIONAL_ADMIN || role === FARO_ROLES.SUPER_ADMIN
}

/** Correos con acceso bootstrap a consola Sistema (deben tener role super_admin en DB). */
export const SUPER_ADMIN_EMAILS = ['vicentejmn80@gmail.com'] as const

export const PROFILE_STATUS_LABELS: Record<'active' | 'suspended' | 'pending', string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  pending: 'Pendiente',
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof SUPER_ADMIN_EMAILS)[number])
}

export function canAccessSystemPanel(role: FaroRole | null | undefined, email?: string | null): boolean {
  return role === FARO_ROLES.SUPER_ADMIN || isSuperAdminEmail(email)
}

export function resolveDisplayRole(
  profile: { role: Exclude<FaroRole, 'public'> | null; status: string } | null,
  hasCoordinatorAssignment: boolean,
): FaroRole {
  if (!profile?.role || profile.status !== 'active') return FARO_ROLES.PUBLIC
  if (profile.role === FARO_ROLES.COORDINATOR && !hasCoordinatorAssignment) return FARO_ROLES.PUBLIC
  return profile.role
}

export function resolveDisplayRoleLabel(
  profile: { role: Exclude<FaroRole, 'public'> | null; status: string } | null,
  hasCoordinatorAssignment: boolean,
): string {
  if (profile?.role === FARO_ROLES.COORDINATOR && profile.status === 'active' && !hasCoordinatorAssignment) {
    return 'Pendiente de centro'
  }
  return FARO_ROLE_LABELS[resolveDisplayRole(profile, hasCoordinatorAssignment)]
}
