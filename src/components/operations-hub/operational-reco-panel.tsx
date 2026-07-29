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
  onEscalateInstitution?: () => void
}

/** IA Operacional V1 — ayuda a decidir sin obligar. */
export function OperationalRecoPanel({
  caseData,
  onUseInventory,
  onOpenCoverage,
  onEscalateInstitution,
}: OperationalRecoPanelProps) {
  const enabled = isReviewStage(caseData.pipelineStage) || isCoverageStage(caseData.pipelineStage)
  const { data, isLoading } = useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'ops-reco', caseData.id, caseData.pipelineStage],
    queryFn: () => operationalRecommendationService.recommend(caseData),
    enabled,
    staleTime: 20_000,
  })

  if (!enabled) return null

  return (
    <GlassCard className="!rounded-xl !border-info/25 !bg-info/[0.06] !p-3 !shadow-none space-y-2.5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-info">
          IA Operacional
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Esta necesidad puede resolverse de varias maneras.
        </p>
      </div>

      {isLoading || !data ? (
        <p className="text-[11px] text-ink-faint">Analizando inventario y cobertura…</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {data.paths.map((p) => (
              <li key={p.id} className="flex gap-2 text-xs text-ink">
                <span className={p.id === data.primary ? 'text-operational' : 'text-ink-faint'}>
                  {p.id === data.primary ? '✓' : '·'}
                </span>
                <span>
                  <span className="font-medium">{p.title}</span>
                  <span className="block text-[10px] text-ink-faint">{p.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-faint">Recomendación principal</p>
            <p className="text-sm font-semibold text-ink">{data.headline}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Tiempo estimado · {data.estimatedMinutes} min · {data.resourceLabel} (≥{data.minQty})
            </p>
          </div>

          {data.inventory[0] && (
            <p className="text-[11px] text-operational">
              {data.inventory[0].centerName}: {data.inventory[0].available} {data.inventory[0].unit} a{' '}
              {data.inventory[0].distanceKm.toFixed(1)} km — ¿recoger allí?
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {data.primary === 'inventory' && onUseInventory && (
              <EmergencyButton variant="primary" size="sm" onClick={onUseInventory}>
                Usar inventario
              </EmergencyButton>
            )}
            {onOpenCoverage && (
              <EmergencyButton variant="glass" size="sm" onClick={onOpenCoverage}>
                Abrir cobertura
              </EmergencyButton>
            )}
            {onEscalateInstitution && (
              <EmergencyButton variant="ghost" size="sm" onClick={onEscalateInstitution}>
                Escalar institución
              </EmergencyButton>
            )}
          </div>
        </>
      )}
    </GlassCard>
  )
}
