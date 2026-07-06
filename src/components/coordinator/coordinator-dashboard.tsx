import { ArrowRight, ClipboardList, PackagePlus, Users } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CoordinatorDashboardMetrics } from '@/services/coordinator-service'
import { cn, timeAgo } from '@/lib/utils'

interface CoordinatorDashboardProps {
  metrics: CoordinatorDashboardMetrics
  onOpenDetail: () => void
  onGoNeeds: () => void
  onGoReports: () => void
}

export function CoordinatorDashboard({
  metrics,
  onOpenDetail,
  onGoNeeds,
  onGoReports,
}: CoordinatorDashboardProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Necesidades activas"
          value={String(metrics.activeNeedsCount)}
          tone={metrics.activeNeedsCount > 0 ? 'warning' : 'operational'}
        />
        <MetricCard
          label="Reportes pendientes"
          value={String(metrics.pendingReportsCount)}
          tone={metrics.pendingReportsCount > 0 ? 'critical' : 'operational'}
        />
        <MetricCard
          label="Saturación por necesidades"
          value={`${metrics.productSaturationPct}%`}
          tone={saturationTone(metrics.productSaturationPct, true)}
        />
      </div>

      <GlassCard className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">Estado operativo</p>
        <p className="text-sm text-ink">{metrics.operationalStatus}</p>
        <p className="text-xs text-ink-subtle">Última actualización {timeAgo(metrics.lastUpdated)}</p>
      </GlassCard>

      <div className="grid grid-cols-1 gap-2">
        <QuickLink icon={PackagePlus} label="Gestionar necesidades" onClick={onGoNeeds} />
        <QuickLink icon={ClipboardList} label="Revisar reportes ciudadanos" onClick={onGoReports} />
        <QuickLink icon={Users} label="Ver ficha pública del centro" onClick={onOpenDetail} />
      </div>
    </div>
  )
}

function saturationTone(pct: number, inverted = false): 'operational' | 'warning' | 'critical' {
  const effective = inverted ? 100 - pct : pct
  if (effective >= 85) return 'critical'
  if (effective >= 65) return 'warning'
  return 'operational'
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'operational' | 'warning' | 'critical'
}) {
  const toneClass =
    tone === 'critical' ? 'text-critical' : tone === 'warning' ? 'text-warning' : 'text-operational'
  return (
    <GlassCard className="space-y-1 p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className={cn('text-2xl font-semibold tabular-nums', toneClass)}>{value}</p>
    </GlassCard>
  )
}

function QuickLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof PackagePlus
  label: string
  onClick: () => void
}) {
  return (
    <EmergencyButton variant="glass" size="md" className="w-full justify-between" onClick={onClick}>
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-ink-faint" />
    </EmergencyButton>
  )
}
