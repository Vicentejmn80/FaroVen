import { cn } from '@/lib/utils'
import type { PriorityLevel } from '@/domain/models'

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  critical: 'bg-critical/15 text-critical',
  high: 'bg-warning/15 text-warning',
  medium: 'bg-info/15 text-info',
  low: 'bg-white/[0.06] text-ink-subtle',
}

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

interface PriorityBadgeProps {
  priority: PriorityLevel
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
