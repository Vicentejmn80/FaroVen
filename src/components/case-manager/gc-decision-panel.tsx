import { useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { REQUEST_SOURCE_LABELS, OPERATION_TYPE_LABELS } from '@/domain/case-lifecycle.types'
import { useRecommendedCenters } from '@/hooks/useLogistics'
import { resolveCaseResource } from '@/domain/case-resource'
import { cn } from '@/lib/utils'

export type TransferExecutor = 'volunteer' | 'institution' | 'node'

interface GcDecisionPanelProps {
  caseData: CaseDomain
  busy?: boolean
  onOpenRadar: () => void
  onAssignInstitution: () => void
  onTransfer: (payload: {
    executor: TransferExecutor
    originCenterId: string
    resourceType: string
  }) => void
}

/**
 * Asistente FARO: analiza inventario y recomienda Transferencia o Radar.
 * El GC confirma la decisión y elige ejecutor si hay stock.
 */
export function GcDecisionPanel({
  caseData,
  busy,
  onOpenRadar,
  onAssignInstitution,
  onTransfer,
}: GcDecisionPanelProps) {
  const resource = resolveCaseResource(caseData)
  const minQty = resource.requiredQty
  const { data: recommended = [], isLoading } = useRecommendedCenters({
    resourceType: resource.resourceType,
    resourceLabel: resource.resourceLabel,
    itemId: resource.itemId,
    minQty: 1,
    missionLat: caseData.location.lat,
    missionLng: caseData.location.lng,
  })
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null)
  const [executor, setExecutor] = useState<TransferExecutor>('volunteer')

  const candidates = recommended
  const hasStock = candidates.length > 0
  const originId = selectedOrigin ?? candidates[0]?.centerId ?? null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-ink-subtle">
          {REQUEST_SOURCE_LABELS[caseData.requestSource] ?? caseData.requestSource}
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-ink-subtle">
          {OPERATION_TYPE_LABELS[caseData.operationType] ?? caseData.operationType}
        </span>
        {caseData.category && (
          <span className="rounded-full bg-info/15 px-2 py-0.5 text-info">{caseData.category}</span>
        )}
      </div>

      <GlassCard className="space-y-2 border-info/20 bg-info/[0.06] p-3">
        <p className="text-xs font-semibold text-ink">Análisis FARO · inventario</p>
        {isLoading ? (
          <p className="text-[11px] text-ink-faint">Consultando nodos logísticos…</p>
        ) : hasStock ? (
          <>
            <p className="text-[11px] text-operational">
              Hay stock de {resource.resourceLabel} (≥{minQty}) en {candidates.length} nodo(s).
              Recomendación: <strong>Transferencia</strong>.
            </p>
            <div className="space-y-1.5">
              {candidates.slice(0, 5).map((row) => (
                <button
                  key={row.centerId}
                  type="button"
                  onClick={() => setSelectedOrigin(row.centerId)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs',
                    originId === row.centerId
                      ? 'border-info/50 bg-info/10 text-ink'
                      : 'border-white/10 bg-white/[0.03] text-ink-muted',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{row.centerName}</span>
                    <span className="text-[10px] text-ink-faint">
                      {row.distanceKm} km · {row.operationalMode === 'active' ? 'Activo' : 'Limitado'}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-operational">
                    {row.available} {row.unit}
                  </span>
                </button>
              ))}
            </div>

            <p className="pt-1 text-[11px] text-ink-subtle">¿Quién ejecuta la transferencia?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'volunteer' as const, label: 'Voluntario' },
                  { id: 'institution' as const, label: 'Institución' },
                  { id: 'node' as const, label: 'Nodo' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExecutor(opt.id)}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] font-medium',
                    executor === opt.id
                      ? 'border-info/50 bg-info/15 text-ink'
                      : 'border-white/10 text-ink-subtle',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <EmergencyButton
              variant="primary"
              size="sm"
              className="w-full"
              disabled={busy || !originId}
              onClick={() => {
                if (!originId) return
                onTransfer({
                  executor,
                  originCenterId: originId,
                  resourceType: resource.resourceType,
                })
              }}
            >
              Confirmar transferencia
            </EmergencyButton>
          </>
        ) : (
          <>
            <p className="text-[11px] text-warning">
              Sin stock suficiente de {resource.resourceLabel} en otros nodos.
              Recomendación: <strong>Radar de voluntarios</strong> o asignar institución.
            </p>
            <div className="flex gap-2">
              <EmergencyButton
                variant="primary"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={onOpenRadar}
              >
                Abrir radar
              </EmergencyButton>
              <EmergencyButton
                variant="glass"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={onAssignInstitution}
              >
                Asignar institución
              </EmergencyButton>
            </div>
          </>
        )}
      </GlassCard>

      {hasStock && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenRadar}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/[0.08] px-3 py-2 text-left text-xs hover:bg-white/[0.04]"
          >
            <p className="font-medium text-ink">Abrir radar igual</p>
            <p className="mt-0.5 text-ink-faint">Ignorar stock y convocar voluntarios</p>
          </button>
          <button
            type="button"
            onClick={onAssignInstitution}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/[0.08] px-3 py-2 text-left text-xs hover:bg-white/[0.04]"
          >
            <p className="font-medium text-ink">Asignar institución</p>
            <p className="mt-0.5 text-ink-faint">Sin transferencia de inventario</p>
          </button>
        </div>
      )}
    </div>
  )
}
