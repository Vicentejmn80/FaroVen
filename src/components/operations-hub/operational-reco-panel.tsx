import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { isReviewStage, isCoverageStage } from '@/domain/ops-pipeline'
import { operationalRecommendationService } from '@/services/operational-recommendation-service'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'

interface OperationalRecoPanelProps {
  caseData: CaseDomain
  onUseInventory?: () => void
  onOpenCoverage?: () => void
  radarBlockedReason?: string
}

/** Recomendación corta: una idea + acciones, sin ruido. */
export function OperationalRecoPanel({
  caseData,
  onUseInventory,
  onOpenCoverage,
  radarBlockedReason,
}: OperationalRecoPanelProps) {
  const enabled = isReviewStage(caseData.pipelineStage) || isCoverageStage(caseData.pipelineStage)
  const { data, isLoading } = useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'ops-reco', caseData.id, caseData.pipelineStage],
    queryFn: () => operationalRecommendationService.recommend(caseData),
    enabled,
    staleTime: 20_000,
  })

  if (!enabled) return null

  const tip = data?.inventory[0]
  const showInventory = Boolean((data?.primary === 'inventory' || tip) && onUseInventory)

  return (
    <GlassCard className="!rounded-xl !border-info/20 !bg-info/[0.05] !p-3 !shadow-none space-y-2">
      {isLoading || !data ? (
        <p className="text-[11px] text-ink-faint">Buscando opciones…</p>
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold text-ink">{data.headline}</p>
            {tip ? (
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {tip.centerName}: {tip.available} {tip.unit} · {tip.distanceKm.toFixed(1)} km
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-ink-muted">
                ~{data.estimatedMinutes} min · {data.resourceLabel}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {showInventory && (
              <EmergencyButton variant="primary" size="sm" onClick={onUseInventory}>
                Usar inventario
              </EmergencyButton>
            )}
            {onOpenCoverage && (
              <EmergencyButton
                variant={data.primary === 'volunteers' || !showInventory ? 'primary' : 'glass'}
                size="sm"
                onClick={onOpenCoverage}
              >
                Abrir radar
              </EmergencyButton>
            )}
            {radarBlockedReason && !onOpenCoverage && (
              <p className="text-[10px] text-ink-faint">{radarBlockedReason}</p>
            )}
          </div>
        </>
      )}
    </GlassCard>
  )
}
