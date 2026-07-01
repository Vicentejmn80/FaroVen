import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CoordinatorDashboardMetrics } from '@/services/coordinator-service'
import type { Site } from '@/lib/types'
import { cn } from '@/lib/utils'

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
  const peopleEligible = site.type === 'hospital' || site.type === 'shelter'

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-3">
        <div>
          <p className="text-sm font-medium text-ink">Saturación de personas</p>
          <p className="text-xs text-ink-subtle">Ocupación manual del centro (camas / cupos).</p>
        </div>
        <SaturationBar pct={metrics.peopleSaturationPct} inverted />
        <p className="text-2xl font-semibold tabular-nums text-ink">{metrics.peopleSaturationPct}%</p>
        {peopleEligible ? (
          <EmergencyButton variant="primary" size="md" className="w-full" onClick={onUpdatePeople}>
            Actualizar ocupación
          </EmergencyButton>
        ) : (
          <p className="text-xs text-ink-subtle">
            Este indicador aplica a hospitales y refugios. En centros de acopio se usa capacidad
            logística.
          </p>
        )}
      </GlassCard>

      <GlassCard className="space-y-3">
        <div>
          <p className="text-sm font-medium text-ink">Saturación de productos</p>
          <p className="text-xs text-ink-subtle">
            Calculada automáticamente según necesidades activas e inventario disponible.
          </p>
        </div>
        <SaturationBar pct={metrics.productSaturationPct} />
        <p className="text-2xl font-semibold tabular-nums text-ink">{metrics.productSaturationPct}%</p>
        <p className="rounded-2xl bg-white/[0.04] px-3 py-2 text-xs text-ink-subtle">
          Se actualiza sola al registrar llegadas, salidas o editar necesidades. No requiere valor
          manual.
        </p>
      </GlassCard>
    </div>
  )
}

function SaturationBar({ pct, inverted = false }: { pct: number; inverted?: boolean }) {
  const display = inverted ? pct : 100 - pct
  const tone = display >= 85 ? 'bg-critical' : display >= 65 ? 'bg-warning' : 'bg-operational'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}
