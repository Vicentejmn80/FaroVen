import { Building2, FileText, Settings2, Shield, Users } from 'lucide-react'
import { SectionTitle } from '@/components/faro/section-title'
import { cn } from '@/lib/utils'

interface QuickActionItem {
  id: 'users' | 'reports' | 'needs' | 'settings' | 'system'
  label: string
  count: number
  icon: typeof Users
}

interface CaseQuickActionsProps {
  counts: Record<QuickActionItem['id'], number>
  onAction: (id: QuickActionItem['id']) => void
}

const ACTIONS: QuickActionItem[] = [
  { id: 'users', label: 'Usuarios', count: 0, icon: Users },
  { id: 'reports', label: 'Reportes', count: 0, icon: FileText },
  { id: 'needs', label: 'Necesidades', count: 0, icon: Building2 },
  { id: 'settings', label: 'Config.', count: 0, icon: Settings2 },
  { id: 'system', label: 'Sistema', count: 0, icon: Shield },
]

export function CaseQuickActions({ counts, onAction }: CaseQuickActionsProps) {
  return (
    <section className="space-y-3">
      <SectionTitle>Acciones rápidas</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          const total = counts[action.id] ?? action.count
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-left',
                'transition-colors hover:bg-white/[0.08]',
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-info">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-lg font-semibold tabular-nums text-ink">{total}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  {action.label}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
