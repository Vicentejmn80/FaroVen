import { useMemo, useState } from 'react'
import { CheckCircle2, Siren } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { STATUS } from '@/lib/status-config'
import { cn } from '@/lib/utils'
import { buildSituationSummary } from '@/lib/situation-intelligence'
import type { Need } from '@/domain/models'
import type { Site } from '@/lib/types'

interface SituationSummaryProps {
  sites: Site[]
  needs?: Need[]
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
  needs = [],
  title = 'Resumen ejecutivo',
  compact = false,
  className,
}: SituationSummaryProps) {
  const summary = useMemo(() => buildSituationSummary(sites, needs), [sites, needs])
  const [showHistory, setShowHistory] = useState(false)
  const priorities = compact ? summary.priorities.slice(0, 2) : summary.priorities
  const history = compact ? summary.resolvedHistory.slice(0, 6) : summary.resolvedHistory

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
        {priorities.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-xs text-ink-subtle">
            No hay necesidades pendientes.
          </div>
        ) : (
          <div className="space-y-2">
            {priorities.map((priority) => (
              <div key={priority.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
                <p className="text-sm font-medium text-ink">{priority.resourceName}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">{priority.centerName}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-1">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Prioridad</p>
                    <p className={STATUS[priority.severity].text}>{labelPriority(priority.priority)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-1">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Cobertura actual</p>
                    <p className="text-ink">
                      {priority.currentQty} / {priority.targetQty}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-1">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Cantidad actual</p>
                    <p className="text-ink">{priority.currentQty}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-1">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Cantidad objetivo</p>
                    <p className="text-ink">{priority.targetQty}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-critical">Faltan: {priority.missingQty}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
            <CheckCircle2 className="h-3.5 w-3.5 text-operational" /> Necesidades resueltas
          </p>
          <p className="text-sm text-ink">✓ {summary.resolvedCount} necesidades resueltas</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-info"
            onClick={() => setShowHistory((prev) => !prev)}
          >
            {showHistory ? 'Ocultar historial' : 'Ver historial'}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
              {history.length === 0 ? (
                <p className="text-xs text-ink-subtle">Sin historial reciente.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="text-xs text-ink">
                    <p>{item.resourceName}</p>
                    <p className="text-ink-subtle">{item.centerName}</p>
                    <p className="text-ink-faint">
                      {item.currentQty}/{item.targetQty} · {item.coveragePct}% ·{' '}
                      {item.resolvedAt.toLocaleString('es-VE')}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </GlassCard>
  )
}

function labelPriority(priority: Need['priority']): string {
  if (priority === 'critical') return 'CRITICA'
  if (priority === 'high') return 'ALTA'
  if (priority === 'medium') return 'MEDIA'
  return 'BAJA'
}
