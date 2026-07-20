import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

export type MetricTone = 'operational' | 'warning' | 'critical' | 'info' | 'neutral'

const TONE_VALUE: Record<MetricTone, string> = {
  critical: 'text-critical',
  warning: 'text-warning',
  operational: 'text-operational',
  info: 'text-info',
  neutral: 'text-ink',
}

const TONE_ICON: Record<MetricTone, string> = {
  critical: 'text-critical',
  warning: 'text-warning',
  operational: 'text-operational',
  info: 'text-info',
  neutral: 'text-ink-subtle',
}

interface MetricCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  tone?: MetricTone
  className?: string
}

/** KPI card del lenguaje dashboard operativo FARO. */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  className,
}: MetricCardProps) {
  return (
    <GlassCard className={cn('space-y-2 p-3.5', className)}>
      <div className="flex items-start justify-between gap-2">
        {Icon ? (
          <Icon className={cn('h-4 w-4 shrink-0', TONE_ICON[tone])} strokeWidth={1.75} aria-hidden />
        ) : (
          <span />
        )}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', TONE_VALUE[tone])}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-ink-faint">{hint}</p> : null}
    </GlassCard>
  )
}
