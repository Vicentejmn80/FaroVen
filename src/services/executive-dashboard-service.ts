import type { ExecutiveDashboardData } from '@/domain/operational-intelligence.types'
import { operationalIntelligenceService } from './operational-intelligence-service'

export const executiveDashboardService = {
  async getDashboardData(): Promise<ExecutiveDashboardData> {
    const context = await operationalIntelligenceService.buildFullContext()

    return {
      metrics: context.currentSituation,
      risk: context.globalRisk,
      recommendations: context.recommendedActions,
      heatZones: context.heatZones,
      trends: context.trends,
      timeline: context.timeline,
      regionalSummary: context.regionalSummary,
      demandAnalysis: context.demandAnalysis,
      decisions: context.decisions,
      resources: context.criticalResources,
      timestamp: context.timestamp,
    }
  },
}
