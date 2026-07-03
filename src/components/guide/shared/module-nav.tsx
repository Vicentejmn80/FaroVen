import { cn } from '@/lib/utils'
import type { GuideModuleId } from '@/domain/guide-models'

interface ModuleNavProps {
  modules: Array<{ id: GuideModuleId; label: string }>
  active?: GuideModuleId | null
  onSelect: (id: GuideModuleId) => void
}

export function ModuleNav({ modules, active, onSelect }: ModuleNavProps) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {modules.map((mod) => (
        <button
          key={mod.id}
          type="button"
          onClick={() => onSelect(mod.id)}
          className={cn(
            'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
            active === mod.id
              ? 'border-info/60 bg-info-soft text-ink'
              : 'border-white/10 bg-white/[0.04] text-ink-muted hover:bg-white/[0.07]',
          )}
        >
          {mod.label}
        </button>
      ))}
    </div>
  )
}
