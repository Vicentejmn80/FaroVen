export const PUBLIC_NEED_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  RESERVED: 'reserved',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
} as const

export type PublicNeedStatus = typeof PUBLIC_NEED_STATUS[keyof typeof PUBLIC_NEED_STATUS]

export const NEED_VERIFICATION_STATUS = {
  PENDING_ENTRY: 'pending_entry',
  APPROVED_ENTRY: 'approved_entry',
  REJECTED_ENTRY: 'rejected_entry',
  PENDING_EXIT: 'pending_exit',
  APPROVED_EXIT: 'approved_exit',
  REJECTED_EXIT: 'rejected_exit',
} as const

export type NeedVerificationStatus =
  typeof NEED_VERIFICATION_STATUS[keyof typeof NEED_VERIFICATION_STATUS]

export const NEED_VISIBILITY_STATUS = {
  HIDDEN: 'hidden',
  PUBLIC: 'public',
  RESTRICTED: 'restricted',
} as const

export type NeedVisibilityStatus =
  typeof NEED_VISIBILITY_STATUS[keyof typeof NEED_VISIBILITY_STATUS]

export const COVERAGE_RESERVATION_STATUS = {
  RESERVED: 'reserved',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const

export type CoverageReservationStatus =
  typeof COVERAGE_RESERVATION_STATUS[keyof typeof COVERAGE_RESERVATION_STATUS]

export interface PublicNeedLocation {
  lat?: number
  lng?: number
  zone?: string
  address?: string
}

export interface PublicNeed {
  id: string
  reportId: string | null
  caseId: string | null
  title: string
  summary: string
  category: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  locationPublic: PublicNeedLocation
  locationPrivate?: Record<string, unknown> | null
  requiredQuantity: number
  coveredQuantity: number
  remainingQuantity: number
  unit: string
  verificationStatus: NeedVerificationStatus
  visibilityStatus: NeedVisibilityStatus
  expiresAt: Date
  status: PublicNeedStatus
  verifiedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface NeedCoverage {
  id: string
  publicNeedId: string
  collaboratorType: 'citizen' | 'volunteer' | 'organization' | 'coordinator'
  collaboratorName: string | null
  quantity: number
  unit: string
  status: 'partial' | 'complete' | 'cancelled'
  createdAt: Date
}

export interface CoverageReservation {
  id: string
  publicNeedId: string
  collaboratorUserId: string | null
  collaboratorName: string | null
  collaboratorType: 'citizen' | 'volunteer' | 'organization' | 'coordinator'
  quantity: number
  status: CoverageReservationStatus
  expiresAt: Date
  confirmedAt: Date | null
  cancelledAt: Date | null
  createdAt: Date
}

export interface NeedVerification {
  id: string
  publicNeedId: string
  verificationType: 'entry' | 'exit'
  checklist: string[]
  decision: 'approved' | 'rejected' | 'needs_info'
  notes: string | null
  verifiedBy: string
  createdAt: Date
}

export interface NeedTimeline {
  id: string
  publicNeedId: string
  eventType: string
  detail: string
  actorId: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface SuccessCase {
  id: string
  publicNeedId: string
  caseId: string | null
  missionId: string | null
  publicCode: string
  zone: string
  helpType: string
  collaboratorType: 'citizen' | 'volunteer' | 'organization' | 'mixed'
  impactSummary: string
  evidenceUrls: string[]
  verifiedBy: string
  verifiedAt: Date
  totalDurationMinutes: number | null
  createdAt: Date
}

