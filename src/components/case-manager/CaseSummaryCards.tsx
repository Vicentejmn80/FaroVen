import type { CaseSummaryFilter, CaseSummaryItem } from '@/types/case.types'
import { cn } from '@/lib/utils'

interface CaseSummaryCardsProps {
  items: CaseSummaryItem[]
  active?: CaseSummaryFilter | null
  onSelect: (filter: CaseSummaryFilter) => void
}

const TONE_CLASS: Record<CaseSummaryItem['tone'], string> = {
  critical: 'bg-critical/10 border-critical/30 text-critical',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  info: 'bg-info/10 border-info/30 text-info',
  operational: 'bg-operational/10 border-operational/30 text-operational',
}

export function CaseSummaryCards({ items, active, onSelect }: CaseSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {items.map((item) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'rounded-2xl border px-3 py-3 text-left transition-colors',
              TONE_CLASS[item.tone],
              isActive ? 'ring-1 ring-white/20' : 'hover:bg-white/[0.06]',
            )}
          >
            <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {item.label}
            </p>
          </button>
        )
      })}
    </div>
  )
}
