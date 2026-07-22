export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'expired'

export interface MissionApplication {
  id: string
  missionId: string
  volunteerId: string
  status: ApplicationStatus
  distanceKm?: number
  etaMinutes?: number
  availability?: string
  notes?: string
  confidence?: number
  currentLat?: number
  currentLng?: number
  applicationSource?: string
  createdAt: Date
  updatedAt: Date
}

export interface MissionApplicationWithVolunteer extends MissionApplication {
  volunteerName: string
  volunteerPhoto?: string
  volunteerPhone?: string
  totalMissions?: number
  completedMissions?: number
  serviceHours?: number
  trustScore?: number
  avgResponseMin?: number
  specialties?: string[]
  lastActivity?: Date
}

export const APPLICATION_VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ['under_review', 'approved', 'rejected', 'withdrawn', 'expired'],
  under_review: ['approved', 'rejected', 'expired'],
  approved: [],
  rejected: [],
  withdrawn: [],
  expired: [],
}

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export const APPLICATION_STATUS_TONES: Record<ApplicationStatus, string> = {
  pending: 'bg-warning/20 text-warning',
  under_review: 'bg-info/20 text-info',
  approved: 'bg-operational/20 text-operational',
  rejected: 'bg-critical/20 text-critical',
  withdrawn: 'bg-white/[0.06] text-ink-muted',
  expired: 'bg-white/[0.06] text-ink-muted',
}
