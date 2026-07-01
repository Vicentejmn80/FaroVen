import { cn } from '@/lib/utils'
import type { TrustLabel } from '@/services/trust-service'

interface TrustIndicatorProps {
  score: number
  label: TrustLabel
  updatedBy?: string
  compact?: boolean
  className?: string
}

const LABEL_TONE: Record<TrustLabel, string> = {
  'Muy alta': 'text-operational',
  Alta: 'text-operational',
  Media: 'text-warning',
  Baja: 'text-critical',
}

const BAR_TONE = (score: number) =>
  score >= 85 ? 'bg-operational' : score >= 70 ? 'bg-operational/80' : score >= 50 ? 'bg-warning' : 'bg-critical'

export function TrustIndicator({
  score,
  label,
  updatedBy,
  compact = false,
  className,
}: TrustIndicatorProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">Confianza</p>
        <p className={cn('text-sm font-semibold tabular-nums', LABEL_TONE[label])}>
          {score}% · {label}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn('h-full rounded-full transition-all', BAR_TONE(score))}
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>
      {!compact && updatedBy && (
        <p className="text-[11px] text-ink-subtle">Actualizado por {updatedBy}</p>
      )}
    </div>
  )
}
