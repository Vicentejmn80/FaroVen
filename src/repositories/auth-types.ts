import type { FaroRole, NetworkRoleRequestStatus, RoleRequestStatus } from '@/lib/roles'
import type { RegisterSiteType } from '@/repositories/types'

export interface ProfileRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: Exclude<FaroRole, 'public'> | null
  organization_id: string | null
  organization_name: string | null
  profession: string | null
  specialty: string | null
  municipality: string | null
  region: string | null
  status: 'active' | 'suspended' | 'pending'
  network_role_selected_at: string | null
  pending_role: Exclude<FaroRole, 'public'> | null
  role_request_reason: string | null
  role_request_status: NetworkRoleRequestStatus | null
  role_request_reviewed_at: string | null
  participation_intent: 'need_help' | 'want_to_help' | 'represent_org' | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface CoordinatorRequestRow {
  id: string
  auth_user_id: string | null
  full_name: string
  email: string
  phone: string | null
  organization: string | null
  requested_site_type: RegisterSiteType | null
  requested_site_id: string | null
  role_title: string | null
  reason: string | null
  status: RoleRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  assigned_site_type: RegisterSiteType | null
  assigned_site_id: string | null
  review_notes: string | null
  info_request_message: string | null
  info_requested_at: string | null
  info_response: string | null
  info_responded_at: string | null
  needs_info_response: boolean
  requested_role: string | null
  experience: string | null
  availability_hours: number | null
  created_at: string
  updated_at: string
}

export interface AuthAuditRow {
  id: string
  actor_user_id: string | null
  action: string
  target_user_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface SubmitCoordinatorRequestInput {
  fullName: string
  email: string
  phone?: string
  organization?: string
  requestedSiteType: RegisterSiteType
  requestedSiteId: string
  roleTitle?: string
  reason?: string
}

export interface SubmitRoleRequestInput {
  fullName: string
  email: string
  phone?: string
  organization?: string
  requestedRole: 'coordinator' | 'case_manager'
  requestedSiteType?: RegisterSiteType
  requestedSiteId?: string
  roleTitle?: string
  reason?: string
  experience?: string
  availabilityHours?: number
}

export interface ApproveCoordinatorRequestInput {
  requestId: string
  assignedSiteType: RegisterSiteType
  assignedSiteId: string
  reviewNotes?: string
}

export interface ApproveRoleRequestInput {
  requestId: string
  assignedSiteType?: RegisterSiteType
  assignedSiteId?: string
  reviewNotes?: string
}

export interface RejectRoleRequestInput {
  requestId: string
  reviewNotes?: string
}
