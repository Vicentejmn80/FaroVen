export type CenterType =
  | 'hospital'
  | 'supply_center'
  | 'shelter'
  | 'medical_center'
  | 'organization'

export type OperationalStatus = 'critical' | 'warning' | 'operational' | 'info'
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type NeedStatus = 'active' | 'covered' | 'resolved'
export type ReportStatus = 'new' | 'verified' | 'discarded'
export type ReportType = 'inventory' | 'saturation' | 'access' | 'shelter' | 'health' | 'other'
export type UserRole = 'citizen' | 'volunteer' | 'coordinator' | 'admin'
export type EventKind =
  | 'inventory'
  | 'saturation'
  | 'report'
  | 'request'
  | 'resolved'
  | 'road_blocked'
  | 'center_opened'
  | 'person_found'

export interface GeoCoordinates {
  lat: number
  lng: number
}

export interface Location {
  zone: string
  address: string
  coordinates: GeoCoordinates
}

export interface Capacity {
  current: number
  total: number
}

export interface ResponsiblePerson {
  name: string
  role: string
  contact?: string
}

export interface Need {
  id: string
  centerId: string
  type: string
  required: number
  available: number
  priority: PriorityLevel
  status: NeedStatus
  updatedAt: Date
}

export interface Report {
  id: string
  type: ReportType
  description: string
  userId: string
  source: string
  createdAt: Date
  status: ReportStatus
  confidence: ConfidenceLevel
  photoUrls: string[]
  location: Location
  centerId?: string
}

export interface Event {
  id: string
  kind: EventKind
  title: string
  detail: string
  centerId?: string
  reportId?: string
  status: OperationalStatus
  createdAt: Date
}

export interface User {
  id: string
  name: string
  role: UserRole
  permissions: string[]
  zone: string
}

export interface Organization {
  id: string
  name: string
  kind: 'ngo' | 'government' | 'community'
  coverageZones: string[]
}

export interface Center {
  id: string
  name: string
  type: CenterType
  status: OperationalStatus
  priority: PriorityLevel
  location: Location
  capacity: Capacity
  responsible: ResponsiblePerson
  updatedAt: Date
  confidence: ConfidenceLevel
  needIds: string[]
  eventIds: string[]
  reportIds: string[]
  photos: { id: string; caption: string; tintClass: string }[]
  organizationId?: string
}

export interface GuideProtocol {
  id: string
  title: string
  summary: string
  steps: string[]
}

export interface GuideCategory {
  id: string
  title: string
  icon: string
  protocols: GuideProtocol[]
}

/**
 * View model conservado para los componentes visuales actuales (mapa, sheet).
 * Se genera desde entidades de dominio en la capa de servicios.
 */
export interface SiteNeed {
  id: string
  item: string
  priority: PriorityLevel
  coverage: number
}

export interface Site {
  id: string
  name: string
  type: CenterType
  status: OperationalStatus
  statusLabel: string
  zone: string
  lat: number
  lng: number
  mapX: number
  mapY: number
  needs: SiteNeed[]
  updatedAt: Date
  verified: boolean
}

export interface BlufMetric {
  id: string
  label: string
  value: number
  unit?: string
  status: OperationalStatus
  trend?: 'up' | 'down' | 'flat'
}
