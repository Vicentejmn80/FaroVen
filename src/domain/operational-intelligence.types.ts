export const ZONE_CLASSIFICATIONS = {
  HOT: 'hot',
  STABLE: 'stable',
  CRITICAL: 'critical',
  NO_COVERAGE: 'no_coverage',
} as const

export type ZoneClassification = typeof ZONE_CLASSIFICATIONS[keyof typeof ZONE_CLASSIFICATIONS]

export const ZONE_CLASSIFICATION_LABELS: Record<ZoneClassification, string> = {
  hot: 'Zona caliente',
  stable: 'Zona estable',
  critical: 'Zona crítica',
  no_coverage: 'Sin cobertura',
}

export const RESOURCE_TYPES = {
  WATER: 'water',
  MEDICINE: 'medicine',
  FOOD: 'food',
  BEDS: 'beds',
  FUEL: 'fuel',
  PERSONNEL: 'personnel',
} as const

export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES]

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  water: 'Agua',
  medicine: 'Medicinas',
  food: 'Alimentos',
  beds: 'Camas',
  fuel: 'Combustible',
  personnel: 'Personal',
}

export const TREND_DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  STABLE: 'stable',
  SURGE: 'surge',
  COLLAPSE: 'collapse',
} as const

export type TrendDirection = typeof TREND_DIRECTIONS[keyof typeof TREND_DIRECTIONS]

export const RECOMMENDATION_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const

export type RecommendationPriority = typeof RECOMMENDATION_PRIORITIES[keyof typeof RECOMMENDATION_PRIORITIES]

export const RECOMMENDATION_CATEGORIES = {
  RESOURCE: 'resource',
  VOLUNTEER: 'volunteer',
  CENTER: 'center',
  EVACUATION: 'evacuation',
  ESCALATION: 'escalation',
  LOGISTICS: 'logistics',
} as const

export type RecommendationCategory = typeof RECOMMENDATION_CATEGORIES[keyof typeof RECOMMENDATION_CATEGORIES]

export const SIMULATION_SCENARIOS = {
  FLOOD: 'flood',
  EARTHQUAKE: 'earthquake',
  FIRE: 'fire',
  LANDSLIDE: 'landslide',
  BLACKOUT: 'blackout',
  MASS_ACCIDENT: 'mass_accident',
} as const

export type SimulationScenario = typeof SIMULATION_SCENARIOS[keyof typeof SIMULATION_SCENARIOS]

export const SIMULATION_SCENARIO_LABELS: Record<SimulationScenario, string> = {
  flood: 'Inundación',
  earthquake: 'Terremoto',
  fire: 'Incendio',
  landslide: 'Deslizamiento',
  blackout: 'Apagón',
  mass_accident: 'Accidente masivo',
}

export const SIMULATION_SCENARIO_ICONS: Record<SimulationScenario, string> = {
  flood: 'Droplets',
  earthquake: 'Building2',
  fire: 'Flame',
  landslide: 'Mountain',
  blackout: 'Zap',
  mass_accident: 'Ambulance',
}

export interface GeoPoint {
  lat: number
  lng: number
  label?: string
}

export interface HeatZone {
  id: string
  name: string
  classification: ZoneClassification
  center: GeoPoint
  radius: number
  caseCount: number
  reportCount: number
  resourceScore: number
  trend: TrendDirection
  lastUpdated: Date
}

export interface ResourceStatus {
  type: ResourceType
  current: number
  capacity: number
  percentage: number
  isCritical: boolean
  centers: Array<{ id: string; name: string; percentage: number }>
}

export interface DemandAnalysis {
  mostNeededResources: Array<{ type: ResourceType; urgency: number; label: string }>
  mostNeededSkills: Array<{ skill: string; count: number; label: string }>
  worseningZones: Array<{ id: string; name: string; rate: number }>
  centersNeedingSupport: Array<{ id: string; name: string; reason: string }>
}

export interface OperationalMetrics {
  totalCases: number
  criticalCases: number
  saturatedCenters: number
  operationalCenters: number
  offlineCenters: number
  activeVolunteers: number
  availableVolunteers: number
  activeMissions: number
  criticalMissions: number
  avgAttentionMinutes: number
  avgArrivalMinutes: number
  breachedSlaCount: number
  totalReports: number
  pendingReports: number
}

export interface TrendPoint {
  timestamp: Date
  value: number
}

export interface TrendResult {
  metric: string
  direction: TrendDirection
  currentValue: number
  previousValue: number
  changePercent: number
  points: TrendPoint[]
  isAlert: boolean
  alertMessage?: string
}

export interface OperationalRisk {
  score: number
  level: 'low' | 'medium' | 'high' | 'critical'
  factors: RiskFactor[]
  timestamp: Date
}

export interface RiskFactor {
  name: string
  weight: number
  score: number
  contribution: number
  status: 'normal' | 'elevated' | 'critical'
  detail: string
}

export interface OperationalRecommendation {
  id: string
  category: RecommendationCategory
  action: string
  description: string
  reason: string
  expectedImpact: string
  priority: RecommendationPriority
  confidence: number
  location?: string
  resourceType?: ResourceType
  centerId?: string
  createdAt: Date
  expiresAt?: Date
}

export interface SimulationConfig {
  scenario: SimulationScenario
  intensity: number
  durationMinutes: number
  citizenCount: number
  centerCount: number
  volunteerCount: number
  resourceAmount: number
  generationSpeed: number
}

export interface SimulationState {
  id: string
  name: string
  config: SimulationConfig
  status: 'running' | 'paused' | 'completed' | 'stopped'
  elapsedMinutes: number
  events: SimulationEvent[]
  metrics: SimulationMetrics
  createdAt: Date
}

export interface SimulationEvent {
  id: string
  type: 'report' | 'case' | 'mission' | 'saturation' | 'resource' | 'notification' | 'escalation'
  timestamp: Date
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  data?: Record<string, unknown>
}

export interface SimulationMetrics {
  reportsGenerated: number
  casesCreated: number
  missionsCreated: number
  volunteersActivated: number
  centersSaturated: number
  resourcesDepleted: number
  criticalEvents: number
}

export interface OperationalTimelineEntry {
  id: string
  timestamp: Date
  type: 'case' | 'mission' | 'center' | 'volunteer' | 'event' | 'alert' | 'resource' | 'saturation' | 'volunteer_dispatch'
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  entityId?: string
  metadata?: Record<string, unknown>
}

export interface RegionalSummary {
  zoneId: string
  zoneName: string
  classification: ZoneClassification
  caseCount: number
  missionCount: number
  volunteerCount: number
  resourcePercentage: number
  riskScore: number
}

export interface DecisionInsight {
  question: string
  answer: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: Date
}

export interface OperationalContext {
  currentSituation: OperationalMetrics
  activeCases: number
  criticalCenters: HeatZone[]
  activeMissions: number
  criticalResources: ResourceStatus[]
  recommendedActions: OperationalRecommendation[]
  globalRisk: OperationalRisk
  timeline: OperationalTimelineEntry[]
  regionalSummary: RegionalSummary[]
  predictions: string[]
  demandAnalysis: DemandAnalysis
  trends: TrendResult[]
  decisions: DecisionInsight[]
  heatZones: HeatZone[]
  timestamp: Date
}

export interface ExecutiveDashboardData {
  metrics: OperationalMetrics
  risk: OperationalRisk
  recommendations: OperationalRecommendation[]
  heatZones: HeatZone[]
  trends: TrendResult[]
  timeline: OperationalTimelineEntry[]
  regionalSummary: RegionalSummary[]
  demandAnalysis: DemandAnalysis
  decisions: DecisionInsight[]
  resources: ResourceStatus[]
  timestamp: Date
}

export const RISK_THRESHOLDS = {
  LOW_MAX: 25,
  MEDIUM_MAX: 50,
  HIGH_MAX: 75,
}

export function classifyRisk(score: number): OperationalRisk['level'] {
  if (score <= RISK_THRESHOLDS.LOW_MAX) return 'low'
  if (score <= RISK_THRESHOLDS.MEDIUM_MAX) return 'medium'
  if (score <= RISK_THRESHOLDS.HIGH_MAX) return 'high'
  return 'critical'
}

export const RESOURCE_CRITICAL_THRESHOLD = 20
export const RESOURCE_WARNING_THRESHOLD = 40
export const CENTER_SATURATION_THRESHOLD = 80
export const URGENT_REPORT_THRESHOLD = 50
