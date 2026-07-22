import { calculateRiskScore, type RiskEngineInput } from '@/domain/risk-engine'
import { generateRecommendations, type RecommendationInput } from '@/domain/recommendation-engine'
import { buildOperationalContext, type ContextInput } from '@/domain/context-builder'
import { MISSION_STAGES } from '@/domain/mission.types'
import type {
  OperationalContext,
  OperationalMetrics,
  ResourceStatus,
  HeatZone,
  TrendResult,
  DemandAnalysis,
  OperationalTimelineEntry,
} from '@/domain/operational-intelligence.types'
import { intelligenceRepository } from '@/repositories/intelligence-repository'
import { missionRepository } from '@/repositories/mission-repository'
import { volunteerRepository } from '@/repositories/volunteer-repository'

export type VolunteerDispatchAction =
  | 'application_submitted'
  | 'application_approved'
  | 'application_rejected'
  | 'accepted'
  | 'assignment_rejected'
  | 'preparing'
  | 'en_route'
  | 'on_site'
  | 'in_progress'
  | 'completed'

export interface VolunteerDispatchEventInput {
  action: VolunteerDispatchAction
  missionId: string
  volunteerId: string
  applicationId?: string
  distanceKm?: number | null
  actorId?: string
  detail?: string
}

const DISPATCH_TITLES: Record<VolunteerDispatchAction, string> = {
  application_submitted: 'Postulación recibida',
  application_approved: 'Postulación aprobada',
  application_rejected: 'Postulación rechazada',
  accepted: 'Asignación aceptada',
  assignment_rejected: 'Asignación rechazada',
  preparing: 'Voluntario preparándose',
  en_route: 'Voluntario en camino',
  on_site: 'Voluntario en sitio',
  in_progress: 'Operación en progreso',
  completed: 'Operación completada',
}

function dispatchSeverity(action: VolunteerDispatchAction): OperationalTimelineEntry['severity'] {
  if (action === 'application_rejected' || action === 'assignment_rejected') return 'warning'
  if (action === 'completed' || action === 'application_approved') return 'info'
  return 'info'
}

export const operationalIntelligenceService = {
  /**
   * Emite un evento al timeline operacional (OIE).
   * Fallos se tragan en silencio para no romper el flujo de dispatch.
   */
  async emitTimelineEvent(
    entry: Omit<OperationalTimelineEntry, 'id' | 'timestamp'> & {
      id?: string
      timestamp?: Date
    },
  ): Promise<void> {
    try {
      await intelligenceRepository.saveTimelineEntry({
        id: entry.id ?? crypto.randomUUID(),
        timestamp: entry.timestamp ?? new Date(),
        type: entry.type,
        title: entry.title,
        description: entry.description,
        severity: entry.severity,
        entityId: entry.entityId,
        metadata: entry.metadata,
      })
    } catch {
      // OIE is best-effort — missing table / RLS must not block missions.
    }
  },

  async emitVolunteerDispatchEvent(input: VolunteerDispatchEventInput): Promise<void> {
    await this.emitTimelineEvent({
      type: 'volunteer_dispatch',
      title: DISPATCH_TITLES[input.action],
      description: input.detail ?? DISPATCH_TITLES[input.action],
      severity: dispatchSeverity(input.action),
      entityId: input.missionId,
      metadata: {
        event_kind: 'volunteer_dispatch',
        action: input.action,
        mission_id: input.missionId,
        volunteer_id: input.volunteerId,
        application_id: input.applicationId ?? null,
        distance_km: input.distanceKm ?? null,
        actor_id: input.actorId ?? null,
      },
    })
  },

  async buildFullContext(): Promise<OperationalContext> {
    const metrics = await this.computeMetrics()
    const resources = await this.computeResourceStatus()
    const heatZones = await this.computeHeatZones()
    const demand = await this.computeDemandAnalysis()
    const trends = await this.computeTrends(metrics)
    const timeline = await this.computeTimeline()

    const riskInput: RiskEngineInput = {
      metrics,
      resourcePercentages: resources.map((r) => r.percentage),
      recentReportRate: metrics.totalReports,
      criticalEventCount: heatZones.filter((z) => z.classification === 'critical').length,
      responseTimeMinutes: metrics.avgAttentionMinutes,
      slaBreachCount: metrics.breachedSlaCount,
    }
    const risk = calculateRiskScore(riskInput)

    const recommendationInput: RecommendationInput = {
      metrics,
      resources,
      heatZones,
      demand,
      availableVolunteers: metrics.availableVolunteers,
      activeMissions: metrics.activeMissions,
      breachedSlaCount: metrics.breachedSlaCount,
    }
    const recommendations = generateRecommendations(recommendationInput)

    const contextInput: ContextInput = {
      metrics,
      risk,
      recommendations,
      timeline,
      heatZones,
      resources,
      trends: Object.values(trends),
      demand,
    }
    const context = buildOperationalContext(contextInput)

    await intelligenceRepository.saveContextSnapshot(context)

    return context
  },

  async computeMetrics(): Promise<OperationalMetrics> {
    const [missions, volunteers] = await Promise.all([
      missionRepository.list(),
      volunteerRepository.list({}),
    ])

    const activeMissions = missions.filter((m) => m.status !== MISSION_STAGES.COMPLETED && m.status !== MISSION_STAGES.VERIFIED && m.status !== MISSION_STAGES.ARCHIVED && m.status !== MISSION_STAGES.CANCELLED)
    const criticalMissions = missions.filter((m) => m.priority === 'critical' && activeMissions.includes(m))
    const activeVolunteers = volunteers.filter((v) => v.availability === 'on_mission')
    const availableVolunteers = volunteers.filter((v) => v.availability === 'available')

    return {
      totalCases: 0,
      criticalCases: 0,
      saturatedCenters: 0,
      operationalCenters: 0,
      offlineCenters: 0,
      activeVolunteers: activeVolunteers.length,
      availableVolunteers: availableVolunteers.length,
      activeMissions: activeMissions.length,
      criticalMissions: criticalMissions.length,
      avgAttentionMinutes: 0,
      avgArrivalMinutes: 0,
      breachedSlaCount: 0,
      totalReports: 0,
      pendingReports: 0,
    }
  },

  async computeResourceStatus(): Promise<ResourceStatus[]> {
    return []
  },

  async computeHeatZones(): Promise<HeatZone[]> {
    return []
  },

  async computeDemandAnalysis(): Promise<DemandAnalysis> {
    return {
      mostNeededResources: [],
      mostNeededSkills: [],
      worseningZones: [],
      centersNeedingSupport: [],
    }
  },

  async computeTrends(_metrics: OperationalMetrics): Promise<Record<string, TrendResult>> {
    return {}
  },

  async computeTimeline(): Promise<any[]> {
    return intelligenceRepository.listTimeline(50)
  },
}
