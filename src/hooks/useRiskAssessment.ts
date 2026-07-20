import { useMemo } from 'react'
import { useOperationalContext } from './useOperationalContext'
import { calculateRiskScore, type RiskEngineInput } from '@/domain/risk-engine'

export function useRiskAssessment() {
  const { data: context, isLoading, error } = useOperationalContext()

  const risk = useMemo(() => {
    if (!context) return null
    return context.globalRisk
  }, [context])

  const recalculateRisk = (input: Partial<RiskEngineInput>) => {
    if (!context) return null
    return calculateRiskScore({
      metrics: context.currentSituation,
      resourcePercentages: input.resourcePercentages ?? context.criticalResources.map((r) => r.percentage),
      recentReportRate: input.recentReportRate ?? context.currentSituation.totalReports,
      criticalEventCount: input.criticalEventCount ?? context.heatZones.filter((z) => z.classification === 'critical').length,
      responseTimeMinutes: input.responseTimeMinutes ?? context.currentSituation.avgAttentionMinutes,
      slaBreachCount: input.slaBreachCount ?? context.currentSituation.breachedSlaCount,
    })
  }

  return { risk, recalculateRisk, isLoading, error }
}
