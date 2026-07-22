import type { RoleRequestStatus } from '@/lib/roles'

export type { RoleRequestStatus }

export const REQUESTED_ROLES = ['coordinator', 'case_manager'] as const
export type RequestedRole = (typeof REQUESTED_ROLES)[number]

export interface RoleRequest {
  id: string
  authUserId: string
  fullName: string
  email: string
  phone?: string
  organization?: string
  requestedRole: RequestedRole
  requestedSiteType?: string
  requestedSiteId?: string
  roleTitle?: string
  reason?: string
  experience?: string
  availabilityHours?: number
  status: RoleRequestStatus
  reviewedBy?: string
  reviewedAt?: Date
  assignedSiteType?: string
  assignedSiteId?: string
  reviewNotes?: string
  createdAt: Date
  updatedAt: Date
}

export const ROLE_REQUEST_VALID_TRANSITIONS: Record<RoleRequestStatus, RoleRequestStatus[]> = {
  pending: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

export function canTransitionRoleRequest(from: RoleRequestStatus, to: RoleRequestStatus): boolean {
  return ROLE_REQUEST_VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export const ROLE_REQUEST_TONES: Record<RoleRequestStatus, string> = {
  pending: 'bg-warning/20 text-warning',
  under_review: 'bg-info/20 text-info',
  approved: 'bg-operational/20 text-operational',
  rejected: 'bg-critical/20 text-critical',
}
