import type { SubmitRoleRequestInput } from '@/repositories/auth-types'
import { ROLE_REQUEST_STATUS } from '@/lib/roles'
import type { RoleRequestStatus } from '@/lib/roles'
import type { RequestedRole } from './role-request.types'
import { canTransitionRoleRequest } from './role-request.types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

const EMAIL_REGEX = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i

export function validateRoleRequestForm(input: Partial<SubmitRoleRequestInput>): ValidationResult {
  const errors: string[] = []

  if (!input.fullName?.trim()) errors.push('El nombre es obligatorio')
  else if (input.fullName.trim().length < 3) errors.push('El nombre debe tener al menos 3 caracteres')

  if (!input.email?.trim()) errors.push('El correo es obligatorio')
  else if (!EMAIL_REGEX.test(input.email.trim())) errors.push('El correo no es válido')

  if (input.phone && input.phone.trim().length < 7) errors.push('El teléfono debe tener al menos 7 dígitos')

  if (!input.requestedRole) errors.push('Selecciona el rol al que deseas postularte')
  else if (!['coordinator', 'case_manager'].includes(input.requestedRole)) errors.push('Rol no válido')

  if (!input.reason?.trim()) errors.push('Cuéntanos por qué deseas este rol')
  else if (input.reason.trim().length < 20) errors.push('Danos más detalles (mínimo 20 caracteres)')

  if (input.requestedRole === 'coordinator') {
    if (!input.requestedSiteType) errors.push('Selecciona el tipo de centro')
    if (!input.requestedSiteId) errors.push('Selecciona el centro')
  }

  return { valid: errors.length === 0, errors }
}

export function canApproveRequest(
  currentStatus: RoleRequestStatus,
  actorRole: string | undefined,
): { allowed: boolean; reason?: string } {
  if (!canTransitionRoleRequest(currentStatus, ROLE_REQUEST_STATUS.APPROVED as RoleRequestStatus)) {
    return { allowed: false, reason: 'La solicitud no está en un estado que permita aprobación' }
  }
  if (!actorRole || !['super_admin', 'regional_admin'].includes(actorRole)) {
    return { allowed: false, reason: 'No tienes permisos para aprobar solicitudes' }
  }
  return { allowed: true }
}

export function canTransitionStatus(
  currentStatus: RoleRequestStatus,
  targetStatus: RoleRequestStatus,
  actorRole: string | undefined,
): { allowed: boolean; reason?: string } {
  if (!canTransitionRoleRequest(currentStatus, targetStatus)) {
    return { allowed: false, reason: `No se puede cambiar de ${currentStatus} a ${targetStatus}` }
  }
  if (!actorRole || !['super_admin', 'regional_admin', 'case_manager'].includes(actorRole)) {
    return { allowed: false, reason: 'No tienes permisos para revisar solicitudes' }
  }
  return { allowed: true }
}

export function formatRequestedRoleLabel(role: RequestedRole): string {
  return role === 'case_manager' ? 'Gestor de Casos' : 'Coordinador'
}
