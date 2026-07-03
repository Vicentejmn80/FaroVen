import { Check } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import type { EmergencyKitItem } from '@/domain/guide-models'
import { cn } from '@/lib/utils'
import { ResourceSection } from '../shared/resource-section'

interface EmergencyKitSectionProps {
  items: EmergencyKitItem[]
  checked: Record<string, boolean>
  completedCount: number
  onToggle: (id: string) => void
  onReset: () => void
}

export function EmergencyKitSection({
  items,
  checked,
  completedCount,
  onToggle,
  onReset,
}: EmergencyKitSectionProps) {
  const total = items.length
  const pct = Math.round((completedCount / total) * 100)

  return (
    <ResourceSection
      id="guide-kit"
      title="Mochila de emergencia"
      action={
        completedCount > 0 ? (
          <EmergencyButton variant="ghost" size="sm" onClick={onReset}>
            Reiniciar
          </EmergencyButton>
        ) : undefined
      }
    >
      <GlassCard inset={false} className="mb-3 overflow-hidden p-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Progreso</span>
            <span className="font-medium text-ink">
              {completedCount}/{total} · {pct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-info transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </GlassCard>

      <div className="space-y-2">
        {items.map((item) => {
          const isChecked = Boolean(checked[item.id])
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                isChecked
                  ? 'border-operational/40 bg-operational/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                  isChecked ? 'border-operational bg-operational text-white' : 'border-white/20',
                )}
              >
                {isChecked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium', isChecked ? 'text-ink-muted line-through' : 'text-ink')}>
                  {item.label}
                  {item.essential && <span className="ml-1 text-critical">*</span>}
                </span>
                {item.hint && <span className="block text-xs text-ink-subtle">{item.hint}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </ResourceSection>
  )
}
