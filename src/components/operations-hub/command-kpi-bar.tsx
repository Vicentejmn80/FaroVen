import { Activity, AlertTriangle, Clock, UserX } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { OpsSummaryItem } from '@/types/operations-hub.types'

interface CommandKpiBarProps {
  items: OpsSummaryItem[]
  className?: string
}

const ICON_BY_ID: Record<string, typeof Activity> = {
  active: Activity,
  critical: AlertTriangle,
  avg_response: Clock,
  unassigned: UserX,
}

const TONE: Record<string, { text: string; glow: string; icon: string }> = {
  critical: {
    text: 'text-critical',
    glow: 'from-critical/20 via-critical/5 to-transparent',
    icon: 'text-critical',
  },
  warning: {
    text: 'text-warning',
    glow: 'from-warning/20 via-warning/5 to-transparent',
    icon: 'text-warning',
  },
  info: {
    text: 'text-info',
    glow: 'from-info/20 via-info/5 to-transparent',
    icon: 'text-info',
  },
  operational: {
    text: 'text-operational',
    glow: 'from-operational/20 via-operational/5 to-transparent',
    icon: 'text-operational',
  },
  neutral: {
    text: 'text-ink',
    glow: 'from-white/10 via-white/[0.03] to-transparent',
    icon: 'text-ink-muted',
  },
}

/** Barra compacta de KPIs de impacto para el Centro de Comando. */
export function CommandKpiBar({ items, className }: CommandKpiBarProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 lg:grid-cols-4', className)}>
      {items.map((item, i) => {
        const tone = TONE[item.tone] ?? TONE.neutral
        const Icon = ICON_BY_ID[item.id] ?? Activity
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className={cn(
              'relative overflow-hidden rounded-xl border border-white/[0.08]',
              'bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-3 py-2.5 backdrop-blur-md',
            )}
          >
            <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80', tone.glow)} />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/20 ring-1 ring-white/[0.06]">
                <Icon className={cn('h-4 w-4', tone.icon)} strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                  {item.label}
                </p>
                <p className={cn('text-xl font-semibold tabular-nums leading-tight', tone.text)}>
                  {item.value}
                </p>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
