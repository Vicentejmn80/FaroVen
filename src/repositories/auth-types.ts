import type { FaroRole } from '@/lib/roles'
import type { CoordinatorRequestStatus } from '@/lib/roles'
import type { RegisterSiteType } from '@/repositories/types'

export interface ProfileRow {
  id: string
  full_name: string
  email: string
  role: Exclude<FaroRole, 'public'> | null
  organization_id: string | null
  status: 'active' | 'suspended' | 'pending'
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
  status: CoordinatorRequestStatus
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

export interface ApproveCoordinatorRequestInput {
  requestId: string
  assignedSiteType: RegisterSiteType
  assignedSiteId: string
  reviewNotes?: string
}
