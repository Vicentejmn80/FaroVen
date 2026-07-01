import { AlertTriangle, CheckCircle2, Siren } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { STATUS } from '@/lib/status-config'
import { cn } from '@/lib/utils'
import { buildSituationSummary } from '@/lib/situation-intelligence'
import type { Site } from '@/lib/types'

interface SituationSummaryProps {
  sites: Site[]
  title?: string
  compact?: boolean
  className?: string
}

/**
 * SituationSummary (BLUF ejecutivo):
 * transforma datos operativos en prioridades accionables para decision rapida.
 */
export function SituationSummary({
  sites,
  title = 'Resumen ejecutivo',
  compact = false,
  className,
}: SituationSummaryProps) {
  const summary = buildSituationSummary(sites)
  const priorities = compact ? summary.priorities.slice(0, 2) : summary.priorities
  const covered = compact ? summary.coveredNeeds.slice(0, 2) : summary.coveredNeeds
  const urgent = compact ? summary.urgentCenters.slice(0, 2) : summary.urgentCenters

  return (
    <GlassCard className={cn('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">{title}</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{summary.headline}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-critical-soft px-2.5 py-1 text-xs font-medium text-critical">
          <Siren className="h-3.5 w-3.5" /> Priorizar ahora
        </span>
      </div>

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">Top 3 prioridades</p>
        <div className="space-y-2">
          {priorities.map((priority) => (
            <div key={priority.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
              <p className={`text-sm font-medium ${STATUS[priority.severity].text}`}>{priority.title}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">{priority.why}</p>
              <p className="mt-1 text-xs text-ink">{priority.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
            <CheckCircle2 className="h-3.5 w-3.5 text-operational" /> Necesidades cubiertas
          </p>
          <ul className="space-y-1.5">
            {covered.map((item) => (
              <li key={item.id} className="text-xs text-ink">
                {item.item}: {item.coverage}%{' '}
                <span className="text-ink-subtle">
                  ({item.centers.slice(0, 2).join(', ') || 'cobertura distribuida'})
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
            <AlertTriangle className="h-3.5 w-3.5 text-critical" /> Atencion inmediata
          </p>
          <ul className="space-y-1.5">
            {urgent.map((center) => (
              <li key={center.siteId} className="text-xs text-ink">
                {center.name} <span className="text-ink-subtle">({center.zone})</span>
                <p className="text-[11px] text-ink-faint">{center.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </GlassCard>
  )
}
