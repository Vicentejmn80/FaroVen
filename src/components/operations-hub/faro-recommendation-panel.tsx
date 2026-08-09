import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { buildFaroRecommendations } from '@/services/faro-recommendation-engine'
import { cn } from '@/lib/utils'

export function FaroRecommendationPanel({
  caseData,
  onAssignCenter,
  /** Si hay centros viables, prioriza centro antes que convocatoria voluntaria. */
  centerFirst = true,
  className,
}: {
  caseData: CaseDomain
  onAssignCenter?: (centerId: string) => void
  centerFirst?: boolean
  className?: string
}) {
  const enabled = Boolean(caseData?.id && caseData.location?.lat && caseData.location?.lng)
  const { data, isLoading } = useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'faro-reco', caseData.id, caseData.pipelineStage],
    queryFn: () => buildFaroRecommendations(caseData),
    enabled,
    staleTime: 20_000,
  })

  const centers = useMemo(() => (data?.centers ?? []).slice(0, 5), [data?.centers])
  const hasViableCenters = centers.length > 0

  return (
    <GlassCard
      className={cn(
        '!rounded-xl !border-operational/20 !bg-operational/[0.05] !p-3 !shadow-none space-y-2.5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-operational">
            Recomendado por FARO
          </p>
          {data ? (
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Buscando {data.requiredQty} × {data.resourceLabel}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Centros sugeridos por reglas operativas.
            </p>
          )}
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-[11px] text-ink-faint">Calculando recomendaciones…</p>
      ) : centers.length === 0 ? (
        <p className="text-[11px] text-ink-muted">
          No hay centros con inventario suficiente. Usa «Publicar necesidad» arriba para convocar
          voluntarios en el mapa.
        </p>
      ) : (
        <div className="space-y-2">
          {centers.map((c) => (
            <div
              key={c.centerId}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{c.centerName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {c.available} {c.unit}
                    </span>
                    <span className="text-ink-faint">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {c.distanceKm.toFixed(1)} km
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-faint">
                    Modo logístico: <span className="text-ink-muted">{c.dispatchModeLabel}</span>
                    <span className="text-ink-faint"> · </span>
                    Coincidencia: <span className="text-ink-muted">{c.matchPct}%</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-ink-muted">
                  Score {c.score}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {onAssignCenter && (
                  <EmergencyButton
                    variant="primary"
                    size="sm"
                    onClick={() => onAssignCenter(c.centerId)}
                  >
                    Solicitar al centro
                  </EmergencyButton>
                )}
                {c.dispatchMode === 'brigade' && (
                  <span className="text-[10px] text-ink-faint self-center">Brigada propia</span>
                )}
              </div>
            </div>
          ))}
          {centerFirst && hasViableCenters && (
            <p className="text-[10px] text-ink-faint">
              Pipeline: solicita al centro primero. Publica la necesidad si responde “necesita
              voluntario”.
            </p>
          )}
        </div>
      )}
    </GlassCard>
  )
}

