import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CoordinatorDashboardMetrics } from '@/services/coordinator-service'
import type { Site } from '@/lib/types'
import { useSiteSaturation } from '@/hooks/useSiteSaturation'
import { SATURATION_LEVEL_LABELS, SATURATION_LEVEL_TONE } from '@/lib/saturation-needs'
import { siteToNeedableType } from '@/lib/site-utils'

interface CoordinatorSaturationModuleProps {
  site: Site
  metrics: CoordinatorDashboardMetrics
  onUpdatePeople: () => void
}

export function CoordinatorSaturationModule({
  site,
  metrics,
  onUpdatePeople,
}: CoordinatorSaturationModuleProps) {
  const { data: saturation } = useSiteSaturation(siteToNeedableType(site), site.id)
  const list = saturation ?? []

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-3">
        <div>
          <p className="text-sm font-medium text-ink">Saturación por necesidades</p>
          <p className="text-xs text-ink-subtle">Selecciona una necesidad y su nivel actual.</p>
        </div>
        {list.length ? (
          <div className="space-y-1 text-sm">
            {list.map((entry) => (
              <div key={entry.needKey} className="flex items-center justify-between">
                <span className="text-ink">{entry.needLabel}</span>
                <span className={SATURATION_LEVEL_TONE[entry.level]}>
                  {SATURATION_LEVEL_LABELS[entry.level]}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-subtle">
            Aún no hay saturaciones registradas. Elige una necesidad para publicar el primer nivel.
          </p>
        )}
        <EmergencyButton variant="primary" size="md" className="w-full" onClick={onUpdatePeople}>
          Actualizar saturación
        </EmergencyButton>
      </GlassCard>

      <GlassCard className="space-y-3">
        <div>
          <p className="text-sm font-medium text-ink">Saturación operativa</p>
          <p className="text-xs text-ink-subtle">
            Indicador automático basado en necesidades activas e inventario disponible.
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-ink">{metrics.productSaturationPct}%</p>
        <p className="rounded-2xl bg-white/[0.04] px-3 py-2 text-xs text-ink-subtle">
          Se actualiza sola al registrar llegadas, salidas o editar necesidades.
        </p>
      </GlassCard>
    </div>
  )
}
