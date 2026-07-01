import { GlassCard } from '@/components/ui/glass-card'
import { timeAgo } from '@/lib/utils'
import type { CenterTimelineEntry } from '@/services/trust-service'

interface CenterActivityTimelineProps {
  items: CenterTimelineEntry[]
  title?: string
  emptyMessage?: string
}

export function CenterActivityTimeline({
  items,
  title = 'Historial de actualizaciones',
  emptyMessage = 'Sin movimientos recientes.',
}: CenterActivityTimelineProps) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">{title}</p>
      <GlassCard className="space-y-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-ink">{item.action}</p>
                <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(item.at)}</span>
              </div>
              <p className="mt-1 text-sm leading-snug text-ink-muted">{item.description}</p>
              <p className="mt-1 text-[11px] text-ink-subtle">{item.actor}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-subtle">{emptyMessage}</p>
        )}
      </GlassCard>
    </section>
  )
}
