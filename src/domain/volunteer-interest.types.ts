export type InterestStatus = 'pending' | 'contacted' | 'accepted' | 'rejected'

export interface VolunteerInterest {
  volunteerId: string
  volunteerName: string
  volunteerEmail?: string
  volunteerPhone?: string
  missionId?: string
  needId?: string
  message?: string
  skills?: string[]
  availability?: string
  status: InterestStatus
  createdAt: Date
  reviewedAt?: Date
  reviewedBy?: string
}

export const INTEREST_VALID_TRANSITIONS: Record<InterestStatus, InterestStatus[]> = {
  pending: ['contacted', 'accepted', 'rejected'],
  contacted: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
}

export function canTransitionInterest(from: InterestStatus, to: InterestStatus): boolean {
  return INTEREST_VALID_TRANSITIONS[from]?.includes(to) ?? false
}
