export type {
  BlufMetric,
  Capacity,
  Center,
  CenterType as SiteType,
  ConfidenceLevel,
  Event,
  GeoCoordinates,
  GuideCategory,
  GuideProtocol,
  Location,
  Need,
  OperationalStatus,
  Organization,
  PriorityLevel as NeedPriority,
  Report,
  Site,
  SiteNeed,
  User,
  UserRole,
} from '@/domain/models'

/** Unión de actividad que usa la UI del timeline actual. */
export type ActivityKind = 'inventory' | 'saturation' | 'report' | 'request' | 'resolved'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  title: string
  detail: string
  siteName?: string
  status: import('@/domain/models').OperationalStatus
  at: Date
}
