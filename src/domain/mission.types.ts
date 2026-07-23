export const MISSION_STAGES = {
  CREATED: 'created',
  MATCHING: 'matching',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  EN_ROUTE: 'en_route',
  ON_SITE: 'on_site',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived',
} as const

export type MissionStage = typeof MISSION_STAGES[keyof typeof MISSION_STAGES]

export const MISSION_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const

export type MissionPriority = typeof MISSION_PRIORITIES[keyof typeof MISSION_PRIORITIES]

export const MISSION_EVENT_TYPES = {
  MISSION_CREATED: 'mission_created',
  APPLICATION_SUBMITTED: 'application_submitted',
  APPLICATION_APPROVED: 'application_approved',
  APPLICATION_REJECTED: 'application_rejected',
  MATCHING_COMPLETED: 'matching_completed',
  VOLUNTEER_ASSIGNED: 'volunteer_assigned',
  VOLUNTEER_ACCEPTED: 'volunteer_accepted',
  VOLUNTEER_PREPARING: 'volunteer_preparing',
  VOLUNTEER_REJECTED: 'volunteer_rejected',
  VOLUNTEER_EN_ROUTE: 'volunteer_en_route',
  VOLUNTEER_ON_SITE: 'volunteer_on_site',
  MISSION_IN_PROGRESS: 'mission_in_progress',
  EVIDENCE_SUBMITTED: 'evidence_submitted',
  MISSION_COMPLETED: 'mission_completed',
  MISSION_VERIFIED: 'mission_verified',
  MISSION_CANCELLED: 'mission_cancelled',
  MISSION_ARCHIVED: 'mission_archived',
  VOLUNTEER_UNAVAILABLE: 'volunteer_unavailable',
  NEEDS_INFO: 'needs_info',
} as const

export type MissionEventType = typeof MISSION_EVENT_TYPES[keyof typeof MISSION_EVENT_TYPES]

export const MISSION_ASSIGNMENT_STATUSES = {
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  PREPARING: 'preparing',
  EN_ROUTE: 'en_route',
  ON_SITE: 'on_site',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived',
} as const

export type MissionAssignmentStatus = typeof MISSION_ASSIGNMENT_STATUSES[keyof typeof MISSION_ASSIGNMENT_STATUSES]

export const ALL_MISSION_STAGES: MissionStage[] = [
  MISSION_STAGES.CREATED,
  MISSION_STAGES.MATCHING,
  MISSION_STAGES.ASSIGNED,
  MISSION_STAGES.ACCEPTED,
  MISSION_STAGES.EN_ROUTE,
  MISSION_STAGES.ON_SITE,
  MISSION_STAGES.IN_PROGRESS,
  MISSION_STAGES.COMPLETED,
  MISSION_STAGES.VERIFIED,
  MISSION_STAGES.CANCELLED,
  MISSION_STAGES.ARCHIVED,
]

export const VALID_MISSION_TRANSITIONS: Record<MissionStage, readonly MissionStage[]> = {
  [MISSION_STAGES.CREATED]: [MISSION_STAGES.MATCHING, MISSION_STAGES.ASSIGNED, MISSION_STAGES.ARCHIVED],
  [MISSION_STAGES.MATCHING]: [MISSION_STAGES.ASSIGNED, MISSION_STAGES.CREATED, MISSION_STAGES.ARCHIVED],
  [MISSION_STAGES.ASSIGNED]: [MISSION_STAGES.ACCEPTED, MISSION_STAGES.MATCHING, MISSION_STAGES.CANCELLED],
  [MISSION_STAGES.ACCEPTED]: [MISSION_STAGES.EN_ROUTE, MISSION_STAGES.CANCELLED],
  [MISSION_STAGES.EN_ROUTE]: [MISSION_STAGES.ON_SITE, MISSION_STAGES.ACCEPTED, MISSION_STAGES.CANCELLED],
  [MISSION_STAGES.ON_SITE]: [MISSION_STAGES.IN_PROGRESS, MISSION_STAGES.EN_ROUTE, MISSION_STAGES.CANCELLED],
  [MISSION_STAGES.IN_PROGRESS]: [MISSION_STAGES.COMPLETED, MISSION_STAGES.ON_SITE, MISSION_STAGES.CANCELLED],
  [MISSION_STAGES.COMPLETED]: [MISSION_STAGES.VERIFIED, MISSION_STAGES.IN_PROGRESS],
  [MISSION_STAGES.VERIFIED]: [MISSION_STAGES.ARCHIVED, MISSION_STAGES.IN_PROGRESS],
  [MISSION_STAGES.CANCELLED]: [],
  [MISSION_STAGES.ARCHIVED]: [],
}

export const MISSION_TRANSITION_TO_EVENT: Record<string, MissionEventType> = {
  [`${MISSION_STAGES.CREATED}->${MISSION_STAGES.MATCHING}`]: MISSION_EVENT_TYPES.MATCHING_COMPLETED,
  [`${MISSION_STAGES.CREATED}->${MISSION_STAGES.ASSIGNED}`]: MISSION_EVENT_TYPES.VOLUNTEER_ASSIGNED,
  [`${MISSION_STAGES.CREATED}->${MISSION_STAGES.ARCHIVED}`]: MISSION_EVENT_TYPES.MISSION_ARCHIVED,
  [`${MISSION_STAGES.MATCHING}->${MISSION_STAGES.ASSIGNED}`]: MISSION_EVENT_TYPES.VOLUNTEER_ASSIGNED,
  [`${MISSION_STAGES.MATCHING}->${MISSION_STAGES.CREATED}`]: MISSION_EVENT_TYPES.NEEDS_INFO,
  [`${MISSION_STAGES.MATCHING}->${MISSION_STAGES.ARCHIVED}`]: MISSION_EVENT_TYPES.MISSION_ARCHIVED,
  [`${MISSION_STAGES.ASSIGNED}->${MISSION_STAGES.ACCEPTED}`]: MISSION_EVENT_TYPES.VOLUNTEER_ACCEPTED,
  [`${MISSION_STAGES.ASSIGNED}->${MISSION_STAGES.MATCHING}`]: MISSION_EVENT_TYPES.VOLUNTEER_UNAVAILABLE,
  [`${MISSION_STAGES.ASSIGNED}->${MISSION_STAGES.CANCELLED}`]: MISSION_EVENT_TYPES.MISSION_CANCELLED,
  [`${MISSION_STAGES.ACCEPTED}->${MISSION_STAGES.EN_ROUTE}`]: MISSION_EVENT_TYPES.VOLUNTEER_EN_ROUTE,
  [`${MISSION_STAGES.ACCEPTED}->${MISSION_STAGES.CANCELLED}`]: MISSION_EVENT_TYPES.MISSION_CANCELLED,
  [`${MISSION_STAGES.EN_ROUTE}->${MISSION_STAGES.ON_SITE}`]: MISSION_EVENT_TYPES.VOLUNTEER_ON_SITE,
  [`${MISSION_STAGES.EN_ROUTE}->${MISSION_STAGES.ACCEPTED}`]: MISSION_EVENT_TYPES.NEEDS_INFO,
  [`${MISSION_STAGES.EN_ROUTE}->${MISSION_STAGES.CANCELLED}`]: MISSION_EVENT_TYPES.MISSION_CANCELLED,
  [`${MISSION_STAGES.ON_SITE}->${MISSION_STAGES.IN_PROGRESS}`]: MISSION_EVENT_TYPES.MISSION_IN_PROGRESS,
  [`${MISSION_STAGES.ON_SITE}->${MISSION_STAGES.EN_ROUTE}`]: MISSION_EVENT_TYPES.NEEDS_INFO,
  [`${MISSION_STAGES.ON_SITE}->${MISSION_STAGES.CANCELLED}`]: MISSION_EVENT_TYPES.MISSION_CANCELLED,
  [`${MISSION_STAGES.IN_PROGRESS}->${MISSION_STAGES.COMPLETED}`]: MISSION_EVENT_TYPES.MISSION_COMPLETED,
  [`${MISSION_STAGES.IN_PROGRESS}->${MISSION_STAGES.ON_SITE}`]: MISSION_EVENT_TYPES.NEEDS_INFO,
  [`${MISSION_STAGES.IN_PROGRESS}->${MISSION_STAGES.CANCELLED}`]: MISSION_EVENT_TYPES.MISSION_CANCELLED,
  [`${MISSION_STAGES.COMPLETED}->${MISSION_STAGES.VERIFIED}`]: MISSION_EVENT_TYPES.MISSION_VERIFIED,
  [`${MISSION_STAGES.COMPLETED}->${MISSION_STAGES.IN_PROGRESS}`]: MISSION_EVENT_TYPES.NEEDS_INFO,
  [`${MISSION_STAGES.VERIFIED}->${MISSION_STAGES.ARCHIVED}`]: MISSION_EVENT_TYPES.MISSION_ARCHIVED,
  [`${MISSION_STAGES.VERIFIED}->${MISSION_STAGES.IN_PROGRESS}`]: MISSION_EVENT_TYPES.NEEDS_INFO,
}

export const MISSION_STAGE_LABELS: Record<MissionStage, string> = {
  [MISSION_STAGES.CREATED]: 'Creada',
  [MISSION_STAGES.MATCHING]: 'Buscando voluntarios',
  [MISSION_STAGES.ASSIGNED]: 'Asignada',
  [MISSION_STAGES.ACCEPTED]: 'Aceptada',
  [MISSION_STAGES.EN_ROUTE]: 'En camino',
  [MISSION_STAGES.ON_SITE]: 'En sitio',
  [MISSION_STAGES.IN_PROGRESS]: 'En progreso',
  [MISSION_STAGES.COMPLETED]: 'Completada',
  [MISSION_STAGES.VERIFIED]: 'Verificada',
  [MISSION_STAGES.CANCELLED]: 'Cancelada',
  [MISSION_STAGES.ARCHIVED]: 'Archivada',
}

export const MISSION_STAGE_TONES: Record<MissionStage, string> = {
  [MISSION_STAGES.CREATED]: 'bg-info/20 text-info',
  [MISSION_STAGES.MATCHING]: 'bg-info/20 text-info',
  [MISSION_STAGES.ASSIGNED]: 'bg-info/20 text-info',
  [MISSION_STAGES.ACCEPTED]: 'bg-operational/20 text-operational',
  [MISSION_STAGES.EN_ROUTE]: 'bg-warning/20 text-warning',
  [MISSION_STAGES.ON_SITE]: 'bg-warning/20 text-warning',
  [MISSION_STAGES.IN_PROGRESS]: 'bg-warning/20 text-warning',
  [MISSION_STAGES.COMPLETED]: 'bg-operational/20 text-operational',
  [MISSION_STAGES.VERIFIED]: 'bg-operational/20 text-operational',
  [MISSION_STAGES.CANCELLED]: 'bg-critical/20 text-critical',
  [MISSION_STAGES.ARCHIVED]: 'bg-white/10 text-ink-faint',
}

export function missionTransitionKey(from: MissionStage, to: MissionStage): string {
  return `${from}->${to}`
}

export interface GeoLocation {
  lat: number
  lng: number
  address?: string
  zone?: string
}

export interface Mission {
  id: string
  supportRequestId?: string
  caseId?: string
  centerId: string
  title: string
  description: string
  priority: MissionPriority
  requiredSkills: string[]
  requiredPeople: number
  assignedPeople: number
  status: MissionStage
  location: GeoLocation
  deadline?: Date
  eta?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  verifiedAt?: Date
  cancelledAt?: Date
  cancellationReason?: string
}

export interface MissionAssignment {
  id: string
  missionId: string
  volunteerId: string
  status: MissionAssignmentStatus
  assignedAt: Date
  respondedAt?: Date
  preparingAt?: Date
  arrivedAt?: Date
  completedAt?: Date
  verifiedAt?: Date
  evidenceUrls: string[]
  rating?: number
  feedback?: string
}

export interface MissionEvent {
  id: string
  missionId: string
  eventType: MissionEventType
  actorId?: string
  actorName?: string
  description?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface TransitionResult {
  mission: Mission
  event: MissionEvent
}
