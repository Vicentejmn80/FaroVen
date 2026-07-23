export const PIPELINE_STAGES = {
  NUEVO: 'nuevo',
  PENDING_REVIEW: 'pending_review',
  VALIDATING: 'validating',
  AWAITING_INFO: 'awaiting_info',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  IN_ATTENTION: 'in_attention',
  RESOLVED: 'resolved',
  ARCHIVED: 'archived',
} as const

export type PipelineStage = typeof PIPELINE_STAGES[keyof typeof PIPELINE_STAGES]

export const CASE_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const

export type CasePriority = typeof CASE_PRIORITIES[keyof typeof CASE_PRIORITIES]

export const CASE_EVENT_TYPES = {
  CASE_SUBMITTED: 'case_submitted',
  CASE_REVIEW_STARTED: 'case_review_started',
  CASE_VALIDATED: 'case_validated',
  CASE_INFO_REQUESTED: 'case_info_requested',
  CASE_INFO_RECEIVED: 'case_info_received',
  CASE_ASSIGNED: 'case_assigned',
  CASE_ACCEPTED: 'case_accepted',
  CASE_ATTENTION_STARTED: 'case_attention_started',
  CASE_RESOLVED: 'case_resolved',
  CASE_REOPENED: 'case_reopened',
  CASE_CLOSED: 'case_closed',
  CASE_DISMISSED: 'case_dismissed',
  CASE_STALE_ARCHIVED: 'case_stale_archived',
  CASE_UNABLE_TO_ASSIGN: 'case_unable_to_assign',
} as const

export type CaseEventType = typeof CASE_EVENT_TYPES[keyof typeof CASE_EVENT_TYPES]

export const ASSIGNMENT_STATUSES = {
  ACTIVE: 'active',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
} as const

export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[keyof typeof ASSIGNMENT_STATUSES]

export const ALL_PIPELINE_STAGES: PipelineStage[] = [
  PIPELINE_STAGES.NUEVO,
  PIPELINE_STAGES.PENDING_REVIEW,
  PIPELINE_STAGES.VALIDATING,
  PIPELINE_STAGES.AWAITING_INFO,
  PIPELINE_STAGES.ASSIGNED,
  PIPELINE_STAGES.ACCEPTED,
  PIPELINE_STAGES.IN_ATTENTION,
  PIPELINE_STAGES.RESOLVED,
  PIPELINE_STAGES.ARCHIVED,
]

export const VALID_TRANSITIONS: Record<PipelineStage, readonly PipelineStage[]> = {
  [PIPELINE_STAGES.NUEVO]: [PIPELINE_STAGES.PENDING_REVIEW, PIPELINE_STAGES.ARCHIVED],
  [PIPELINE_STAGES.PENDING_REVIEW]: [PIPELINE_STAGES.VALIDATING, PIPELINE_STAGES.AWAITING_INFO, PIPELINE_STAGES.ARCHIVED],
  [PIPELINE_STAGES.VALIDATING]: [PIPELINE_STAGES.ASSIGNED, PIPELINE_STAGES.AWAITING_INFO, PIPELINE_STAGES.ARCHIVED],
  [PIPELINE_STAGES.AWAITING_INFO]: [PIPELINE_STAGES.PENDING_REVIEW, PIPELINE_STAGES.ARCHIVED],
  [PIPELINE_STAGES.ASSIGNED]: [PIPELINE_STAGES.ACCEPTED, PIPELINE_STAGES.PENDING_REVIEW, PIPELINE_STAGES.ARCHIVED],
  [PIPELINE_STAGES.ACCEPTED]: [PIPELINE_STAGES.IN_ATTENTION, PIPELINE_STAGES.ARCHIVED],
  [PIPELINE_STAGES.IN_ATTENTION]: [PIPELINE_STAGES.RESOLVED, PIPELINE_STAGES.AWAITING_INFO, PIPELINE_STAGES.ARCHIVED],
  [PIPELINE_STAGES.RESOLVED]: [PIPELINE_STAGES.ARCHIVED, PIPELINE_STAGES.IN_ATTENTION],
  [PIPELINE_STAGES.ARCHIVED]: [],
}

export const TRANSITION_TO_EVENT: Record<string, CaseEventType> = {
  [`${PIPELINE_STAGES.NUEVO}->${PIPELINE_STAGES.PENDING_REVIEW}`]: CASE_EVENT_TYPES.CASE_SUBMITTED,
  [`${PIPELINE_STAGES.NUEVO}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_DISMISSED,
  [`${PIPELINE_STAGES.PENDING_REVIEW}->${PIPELINE_STAGES.VALIDATING}`]: CASE_EVENT_TYPES.CASE_REVIEW_STARTED,
  [`${PIPELINE_STAGES.PENDING_REVIEW}->${PIPELINE_STAGES.AWAITING_INFO}`]: CASE_EVENT_TYPES.CASE_INFO_REQUESTED,
  [`${PIPELINE_STAGES.PENDING_REVIEW}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_DISMISSED,
  [`${PIPELINE_STAGES.VALIDATING}->${PIPELINE_STAGES.ASSIGNED}`]: CASE_EVENT_TYPES.CASE_VALIDATED,
  [`${PIPELINE_STAGES.VALIDATING}->${PIPELINE_STAGES.AWAITING_INFO}`]: CASE_EVENT_TYPES.CASE_INFO_REQUESTED,
  [`${PIPELINE_STAGES.VALIDATING}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_DISMISSED,
  [`${PIPELINE_STAGES.AWAITING_INFO}->${PIPELINE_STAGES.PENDING_REVIEW}`]: CASE_EVENT_TYPES.CASE_INFO_RECEIVED,
  [`${PIPELINE_STAGES.AWAITING_INFO}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_STALE_ARCHIVED,
  [`${PIPELINE_STAGES.ASSIGNED}->${PIPELINE_STAGES.ACCEPTED}`]: CASE_EVENT_TYPES.CASE_ACCEPTED,
  [`${PIPELINE_STAGES.ASSIGNED}->${PIPELINE_STAGES.PENDING_REVIEW}`]: CASE_EVENT_TYPES.CASE_UNABLE_TO_ASSIGN,
  [`${PIPELINE_STAGES.ASSIGNED}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_DISMISSED,
  [`${PIPELINE_STAGES.ACCEPTED}->${PIPELINE_STAGES.IN_ATTENTION}`]: CASE_EVENT_TYPES.CASE_ATTENTION_STARTED,
  [`${PIPELINE_STAGES.ACCEPTED}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_DISMISSED,
  [`${PIPELINE_STAGES.IN_ATTENTION}->${PIPELINE_STAGES.RESOLVED}`]: CASE_EVENT_TYPES.CASE_RESOLVED,
  [`${PIPELINE_STAGES.IN_ATTENTION}->${PIPELINE_STAGES.AWAITING_INFO}`]: CASE_EVENT_TYPES.CASE_INFO_REQUESTED,
  [`${PIPELINE_STAGES.IN_ATTENTION}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_DISMISSED,
  [`${PIPELINE_STAGES.RESOLVED}->${PIPELINE_STAGES.ARCHIVED}`]: CASE_EVENT_TYPES.CASE_CLOSED,
  [`${PIPELINE_STAGES.RESOLVED}->${PIPELINE_STAGES.IN_ATTENTION}`]: CASE_EVENT_TYPES.CASE_REOPENED,
}

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  [PIPELINE_STAGES.NUEVO]: 'Nuevo',
  [PIPELINE_STAGES.PENDING_REVIEW]: 'Pendiente de revisión',
  [PIPELINE_STAGES.VALIDATING]: 'Validando',
  [PIPELINE_STAGES.AWAITING_INFO]: 'Esperando información',
  [PIPELINE_STAGES.ASSIGNED]: 'Asignado',
  [PIPELINE_STAGES.ACCEPTED]: 'Aceptado',
  [PIPELINE_STAGES.IN_ATTENTION]: 'En atención',
  [PIPELINE_STAGES.RESOLVED]: 'Resuelto',
  [PIPELINE_STAGES.ARCHIVED]: 'Archivado',
}

export const PIPELINE_STAGE_TONES: Record<PipelineStage, string> = {
  [PIPELINE_STAGES.NUEVO]: 'bg-info/20 text-info',
  [PIPELINE_STAGES.PENDING_REVIEW]: 'bg-warning/20 text-warning',
  [PIPELINE_STAGES.VALIDATING]: 'bg-info/20 text-info',
  [PIPELINE_STAGES.AWAITING_INFO]: 'bg-warning/20 text-warning',
  [PIPELINE_STAGES.ASSIGNED]: 'bg-info/20 text-info',
  [PIPELINE_STAGES.ACCEPTED]: 'bg-operational/20 text-operational',
  [PIPELINE_STAGES.IN_ATTENTION]: 'bg-operational/20 text-operational',
  [PIPELINE_STAGES.RESOLVED]: 'bg-operational/20 text-operational',
  [PIPELINE_STAGES.ARCHIVED]: 'bg-white/10 text-ink-faint',
}

export function transitionKey(from: PipelineStage, to: PipelineStage): string {
  return `${from}->${to}`
}

export interface GeoLocation {
  lat: number
  lng: number
  address?: string
  zone?: string
}

export interface ReporterInfo {
  name?: string
  phone?: string
  email?: string
  relationship?: string
}

export interface CaseDomain {
  id: string
  title: string
  description: string
  priority: CasePriority
  pipelineStage: PipelineStage
  location: GeoLocation
  zone: string
  affectedCount: number
  reporterInfo: ReporterInfo
  category?: string
  assignedTo?: string
  assignedCenterId?: string
  assignedAt?: Date
  slaDeadline?: Date
  firstResponseAt?: Date
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CaseDomainEvent {
  id: string
  caseId: string
  eventType: CaseEventType
  fromStage?: PipelineStage
  toStage?: PipelineStage
  actorId?: string
  comment?: string
  createdAt: Date
}

export interface CaseAssignment {
  id: string
  caseId: string
  centerId: string
  assignedBy: string
  assignedTo?: string
  status: AssignmentStatus
  assignedAt: Date
  acceptedAt?: Date
  rejectedAt?: Date
  reason?: string
}

export interface TransitionResult {
  case: CaseDomain
  event: CaseDomainEvent
}
