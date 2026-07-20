import { SectionTitle } from '@/components/faro/section-title'
import { GlassCard } from '@/components/ui/glass-card'
import type { CaseActivityItem } from '@/types/case.types'
import { timeAgo } from '@/lib/utils'

interface RecentActivityProps {
  items: CaseActivityItem[]
  onViewAll: () => void
}

export function RecentActivity({ items, onViewAll }: RecentActivityProps) {
  return (
    <section className="space-y-3">
      <SectionTitle
        action={
          <button type="button" onClick={onViewAll} className="text-xs text-info">
            Ver todas →
          </button>
        }
      >
        Actividad reciente
      </SectionTitle>
      <div className="space-y-2">
        {items.length ? (
          items.map((activity) => (
            <GlassCard key={activity.id} inset={false} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
              <p className="text-sm text-ink">{activity.description}</p>
              <p className="mt-1 text-xs text-ink-faint">{timeAgo(activity.createdAt)}</p>
            </GlassCard>
          ))
        ) : (
          <p className="text-sm text-ink-subtle">Sin actividad reciente registrada.</p>
        )}
      </div>
    </section>
  )
}
