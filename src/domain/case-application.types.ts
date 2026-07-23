export type CaseApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'expired'

export interface CaseApplication {
  id: string
  caseId: string
  applicantId: string
  organization?: string
  message?: string
  skills?: string[]
  availability?: string
  distanceKm?: number
  status: CaseApplicationStatus
  createdAt: Date
  updatedAt: Date
}

export interface CaseApplicationWithApplicant extends CaseApplication {
  applicantName: string
  applicantPhone?: string
  applicantPhoto?: string
  totalMissions?: number
  completedMissions?: number
  serviceHours?: number
  trustScore?: number
  avgResponseMin?: number
  specialties?: string[]
  lastActivity?: Date
}

export const CASE_APPLICATION_VALID_TRANSITIONS: Record<CaseApplicationStatus, CaseApplicationStatus[]> = {
  pending: ['under_review', 'approved', 'rejected', 'withdrawn', 'expired'],
  under_review: ['approved', 'rejected', 'expired'],
  approved: [],
  rejected: [],
  withdrawn: [],
  expired: [],
}

export function canTransitionApplication(from: CaseApplicationStatus, to: CaseApplicationStatus): boolean {
  return CASE_APPLICATION_VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export const CASE_APPLICATION_STATUS_TONES: Record<CaseApplicationStatus, string> = {
  pending: 'bg-warning/20 text-warning',
  under_review: 'bg-info/20 text-info',
  approved: 'bg-operational/20 text-operational',
  rejected: 'bg-critical/20 text-critical',
  withdrawn: 'bg-white/[0.06] text-ink-muted',
  expired: 'bg-white/[0.06] text-ink-muted',
}
