import { Users, Package, AlertTriangle, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { StatusBadge } from './status-badge'
import type { CoordinatorDashboardMetrics } from '@/services/coordinator-service'
import type { Site } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

interface CenterSummaryCardProps {
  site: Site
  metrics: CoordinatorDashboardMetrics
}

export function CenterSummaryCard({ site, metrics }: CenterSummaryCardProps) {
  const occupancyPct = metrics.peopleSaturationPct
  const occupancyColor =
    occupancyPct >= 85 ? 'text-critical' : occupancyPct >= 65 ? 'text-warning' : 'text-operational'

  return (
    <GlassCard strong className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">Centro asignado</p>
          <p className="mt-1 truncate text-lg font-semibold text-ink">{metrics.siteName}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">{metrics.siteTypeLabel}</p>
        </div>
        <StatusBadge status={site.status} label={metrics.operationalStatus} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryMetric
          icon={Users}
          label="Ocupación"
          value={`${occupancyPct}%`}
          tone={occupancyColor}
        />
        <SummaryMetric
          icon={Package}
          label="Necesidades"
          value={String(metrics.activeNeedsCount)}
          tone={metrics.activeNeedsCount > 0 ? 'text-warning' : 'text-operational'}
        />
        <SummaryMetric
          icon={AlertTriangle}
          label="Reportes"
          value={String(metrics.pendingReportsCount)}
          tone={metrics.pendingReportsCount > 0 ? 'text-critical' : 'text-operational'}
        />
        <SummaryMetric
          icon={Clock}
          label="Última actualización"
          value={timeAgo(metrics.lastUpdated)}
          tone="text-ink-subtle"
        />
      </div>
    </GlassCard>
  )
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
        <Icon className="h-4 w-4 text-ink-subtle" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
        <p className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
      </div>
    </div>
  )
}
