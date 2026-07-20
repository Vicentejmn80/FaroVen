import { cn } from '@/lib/utils'
import type { OperationalStatus } from '@/domain/models'

const STATUS_STYLES: Record<OperationalStatus, string> = {
  critical: 'bg-critical/15 text-critical ring-critical/30',
  warning: 'bg-warning/15 text-warning ring-warning/30',
  operational: 'bg-operational/15 text-operational ring-operational/30',
  info: 'bg-info/15 text-info ring-info/30',
}

const STATUS_DOTS: Record<OperationalStatus, string> = {
  critical: 'bg-critical',
  warning: 'bg-warning',
  operational: 'bg-operational',
  info: 'bg-info',
}

interface StatusBadgeProps {
  status: OperationalStatus
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[status])} />
      {label ?? status}
    </span>
  )
}
