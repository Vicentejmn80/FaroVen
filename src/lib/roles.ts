/** Roles FARO — única fuente de verdad para permisos en frontend. */
export const FARO_ROLES = {
  PUBLIC: 'public',
  VOLUNTEER: 'volunteer',
  CASE_MANAGER: 'case_manager',
  COORDINATOR: 'coordinator',
  REGIONAL_ADMIN: 'regional_admin',
  SUPER_ADMIN: 'super_admin',
} as const

export type FaroRole = (typeof FARO_ROLES)[keyof typeof FARO_ROLES]

export type RequestableNetworkRole = typeof FARO_ROLES.CASE_MANAGER | typeof FARO_ROLES.COORDINATOR

export const FARO_ROLE_LABELS: Record<FaroRole, string> = {
  [FARO_ROLES.PUBLIC]: 'Ciudadano',
  [FARO_ROLES.VOLUNTEER]: 'Voluntario',
  [FARO_ROLES.CASE_MANAGER]: 'Gestor de Casos',
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

export type NetworkRoleRequestStatus = 'pending' | 'approved' | 'rejected'

export function isElevatedRole(role: FaroRole | null | undefined): boolean {
  return (
    role === FARO_ROLES.COORDINATOR ||
    role === FARO_ROLES.CASE_MANAGER ||
    role === FARO_ROLES.REGIONAL_ADMIN ||
    role === FARO_ROLES.SUPER_ADMIN
  )
}

export function isNetworkMemberRole(role: FaroRole | null | undefined): boolean {
  return (
    role === FARO_ROLES.VOLUNTEER ||
    role === FARO_ROLES.CASE_MANAGER ||
    role === FARO_ROLES.COORDINATOR ||
    role === FARO_ROLES.REGIONAL_ADMIN ||
    role === FARO_ROLES.SUPER_ADMIN
  )
}

export function canAccessCoordinatorPanel(role: FaroRole | null | undefined): boolean {
  return role === FARO_ROLES.COORDINATOR
}

export function canAccessCaseManagerPanel(role: FaroRole | null | undefined): boolean {
  return role === FARO_ROLES.CASE_MANAGER
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

/**
 * ¿Debe forzarse RoleSelectionScreen?
 * Prioridad absoluta: usuario autenticado sin onboarding de red completado.
 *
 * Completó selección si:
 * - tiene network_role_selected_at, o
 * - tiene solicitud pending, o
 * - ya es rol operativo asignado fuera del flujo (coordinator/case_manager/admin).
 *
 * profile === null con sesión activa → true (el gate espera profileReady aparte).
 */
export function needsNetworkRoleSelection(profile: {
  role: Exclude<FaroRole, 'public'> | null
  status: string
  network_role_selected_at?: string | null
  role_request_status?: NetworkRoleRequestStatus | null
} | null): boolean {
  if (!profile) return true
  if (profile.status === 'suspended') return false

  if (profile.network_role_selected_at) return false
  if (profile.role_request_status === 'pending') return false

  // Roles operativos legacy / asignados por admin — no forzar selección
  if (
    profile.role === FARO_ROLES.COORDINATOR ||
    profile.role === FARO_ROLES.CASE_MANAGER ||
    profile.role === FARO_ROLES.REGIONAL_ADMIN ||
    profile.role === FARO_ROLES.SUPER_ADMIN
  ) {
    return false
  }

  // volunteer sin marca de selección = incompleto (no debería ocurrir, pero se fuerza)
  // role null = nunca eligió
  return true
}

/** Alias semántico: “tiene network role / completó el flujo”. */
export function hasCompletedNetworkRoleOnboarding(profile: {
  role: Exclude<FaroRole, 'public'> | null
  status: string
  network_role_selected_at?: string | null
  role_request_status?: NetworkRoleRequestStatus | null
} | null): boolean {
  return !needsNetworkRoleSelection(profile)
}

export function hasPendingNetworkRoleRequest(profile: {
  role_request_status?: NetworkRoleRequestStatus | null
  pending_role?: Exclude<FaroRole, 'public'> | null
} | null): boolean {
  return profile?.role_request_status === 'pending' && Boolean(profile.pending_role)
}

export function pendingRoleLabel(pendingRole: Exclude<FaroRole, 'public'> | null | undefined): string {
  if (!pendingRole) return 'rol'
  return FARO_ROLE_LABELS[pendingRole] ?? pendingRole
}

export function resolveDisplayRole(
  profile: {
    role: Exclude<FaroRole, 'public'> | null
    status: string
  } | null,
  hasCoordinatorAssignment: boolean,
): FaroRole {
  if (!profile?.role || profile.status !== 'active') return FARO_ROLES.PUBLIC
  if (profile.role === FARO_ROLES.COORDINATOR && !hasCoordinatorAssignment) return FARO_ROLES.PUBLIC
  return profile.role
}

export function resolveDisplayRoleLabel(
  profile: {
    role: Exclude<FaroRole, 'public'> | null
    status: string
    role_request_status?: NetworkRoleRequestStatus | null
    pending_role?: Exclude<FaroRole, 'public'> | null
  } | null,
  hasCoordinatorAssignment: boolean,
): string {
  if (hasPendingNetworkRoleRequest(profile)) {
    return `Voluntario · pendiente ${pendingRoleLabel(profile?.pending_role)}`
  }
  if (profile?.role === FARO_ROLES.COORDINATOR && profile.status === 'active' && !hasCoordinatorAssignment) {
    return 'Pendiente de centro'
  }
  return FARO_ROLE_LABELS[resolveDisplayRole(profile, hasCoordinatorAssignment)]
}
