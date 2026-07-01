import { cn } from '@/lib/utils'
import type { ActivityLevel } from '@/services/trust-service'

interface ActivityLevelBadgeProps {
  level: ActivityLevel
  recentEventCount?: number
  className?: string
}

const LEVEL_STYLE: Record<ActivityLevel, string> = {
  'Muy activo': 'text-operational',
  Activo: 'text-info',
  'Poco activo': 'text-warning',
  'Sin actividad reciente': 'text-ink-subtle',
}

export function ActivityLevelBadge({ level, recentEventCount, className }: ActivityLevelBadgeProps) {
  return (
    <div className={cn('text-[11px]', className)}>
      <span className="text-ink-faint">Actividad: </span>
      <span className={cn('font-medium', LEVEL_STYLE[level])}>{level}</span>
      {recentEventCount != null && recentEventCount > 0 && (
        <span className="text-ink-subtle"> · {recentEventCount} mov. (7 d)</span>
      )}
    </div>
  )
}
