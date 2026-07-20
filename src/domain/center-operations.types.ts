export const OPERATIONAL_MODES = {
  ACTIVE: 'active',
  LIMITED: 'limited',
  SATURATED: 'saturated',
  INACTIVE: 'inactive',
  EMERGENCY_ONLY: 'emergency_only',
} as const

export type OperationalMode = typeof OPERATIONAL_MODES[keyof typeof OPERATIONAL_MODES]

export const OPERATIONAL_MODE_LABELS: Record<OperationalMode, string> = {
  [OPERATIONAL_MODES.ACTIVE]: 'Activo',
  [OPERATIONAL_MODES.LIMITED]: 'Capacidad limitada',
  [OPERATIONAL_MODES.SATURATED]: 'Saturado',
  [OPERATIONAL_MODES.INACTIVE]: 'Inactivo',
  [OPERATIONAL_MODES.EMERGENCY_ONLY]: 'Solo emergencias',
}

export const SUPPORT_REQUEST_TYPES = {
  VOLUNTEERS: 'volunteers',
  MEDICAL: 'medical',
  LOGISTICS: 'logistics',
  TRANSPORT: 'transport',
  SUPPLIES: 'supplies',
} as const

export type SupportRequestType = typeof SUPPORT_REQUEST_TYPES[keyof typeof SUPPORT_REQUEST_TYPES]

export const SUPPORT_REQUEST_TYPE_LABELS: Record<SupportRequestType, string> = {
  [SUPPORT_REQUEST_TYPES.VOLUNTEERS]: 'Voluntarios',
  [SUPPORT_REQUEST_TYPES.MEDICAL]: 'Apoyo médico',
  [SUPPORT_REQUEST_TYPES.LOGISTICS]: 'Logística',
  [SUPPORT_REQUEST_TYPES.TRANSPORT]: 'Transporte',
  [SUPPORT_REQUEST_TYPES.SUPPLIES]: 'Insumos',
}

export const SUPPORT_REQUEST_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
} as const

export type SupportRequestStatus = typeof SUPPORT_REQUEST_STATUSES[keyof typeof SUPPORT_REQUEST_STATUSES]

export const CENTER_RESOURCE_TYPES = {
  WATER: 'water',
  MEDICINE: 'medicine',
  FOOD: 'food',
  BEDS: 'beds',
  PERSONNEL: 'personnel',
} as const

export type CenterResourceType = typeof CENTER_RESOURCE_TYPES[keyof typeof CENTER_RESOURCE_TYPES]

export const CENTER_RESOURCE_LABELS: Record<CenterResourceType, string> = {
  [CENTER_RESOURCE_TYPES.WATER]: 'Agua',
  [CENTER_RESOURCE_TYPES.MEDICINE]: 'Medicinas',
  [CENTER_RESOURCE_TYPES.FOOD]: 'Alimentos',
  [CENTER_RESOURCE_TYPES.BEDS]: 'Camas',
  [CENTER_RESOURCE_TYPES.PERSONNEL]: 'Personal disponible',
}

export const CENTER_EVENT_TYPES = {
  CAPACITY_UPDATED: 'capacity_updated',
  RESOURCE_UPDATED: 'resource_updated',
  CASE_ACCEPTED: 'case_accepted',
  CASE_REJECTED: 'case_rejected',
  CASE_RESOLVED: 'case_resolved',
  SUPPORT_REQUESTED: 'support_requested',
  OPERATIONAL_MODE_CHANGED: 'operational_mode_changed',
} as const

export type CenterEventType = typeof CENTER_EVENT_TYPES[keyof typeof CENTER_EVENT_TYPES]

export interface OccupancyDetail {
  adults: number
  children: number
  elderly: number
  disabledMobility: number
}

export interface CenterOperationalProfile {
  centerId: string
  siteType: string
  operationalMode: OperationalMode
  resources: CenterResource[]
  occupancyPct: number
  resourceCoveragePct: number
  activeCaseCount: number
  recentEvents: CenterEvent[]
}

export interface CenterResource {
  id: string
  centerId: string
  resourceType: CenterResourceType
  currentLevel: number
  maxLevel: number
  unit: string
  updatedAt: Date
}

export interface CenterEvent {
  id: string
  centerId: string
  eventType: CenterEventType
  previousValue?: string
  newValue?: string
  actorId?: string
  actorName?: string
  description?: string
  createdAt: Date
}

export interface SupportRequest {
  id: string
  centerId: string
  centerName?: string
  requestType: SupportRequestType
  title: string
  description?: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  quantity: number
  durationHours?: number
  status: SupportRequestStatus
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface SupportRequestInput {
  requestType: string
  title: string
  description: string
  urgency: string
  quantity: number
  durationHours?: number
  createdBy?: string
}

export interface CenterCapacityUpdate {
  centerId: string
  total?: number
  current?: number
  occupancyDetail?: Partial<OccupancyDetail>
  actorId?: string
  actorName?: string
}
