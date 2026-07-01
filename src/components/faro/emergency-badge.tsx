import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/status-config'
import type { OperationalStatus } from '@/lib/types'

interface EmergencyBadgeProps {
  status: OperationalStatus
  label?: string
  /** muestra el icono semántico a la izquierda */
  withIcon?: boolean
  className?: string
}

/**
 * EmergencyBadge — etiqueta de estado semántica, suave y legible (contraste AA).
 */
export function EmergencyBadge({ status, label, withIcon = true, className }: EmergencyBadgeProps) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        s.bg,
        s.text,
        s.ring,
        className,
      )}
    >
      {withIcon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
      {label ?? s.label}
    </span>
  )
}
