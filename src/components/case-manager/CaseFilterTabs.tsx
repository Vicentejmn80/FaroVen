import type { CaseFilterItem, CaseListFilter } from '@/types/case.types'
import { cn } from '@/lib/utils'

interface CaseFilterTabsProps {
  items: CaseFilterItem[]
  active: CaseListFilter
  onChange: (filter: CaseListFilter) => void
}

export function CaseFilterTabs({ items, active, onChange }: CaseFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              isActive
                ? 'border-info/60 bg-info-soft text-ink'
                : 'border-white/10 bg-white/[0.04] text-ink-muted hover:bg-white/[0.08]',
            )}
          >
            {item.label}: {item.count}
          </button>
        )
      })}
    </div>
  )
}
