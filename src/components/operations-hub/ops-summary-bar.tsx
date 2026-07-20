import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { OpsSummaryItem } from '@/types/operations-hub.types'

interface OpsSummaryBarProps {
  items: OpsSummaryItem[]
  className?: string
}

const TONE_CLASS: Record<string, { text: string; bg: string; dot: string }> = {
  critical: { text: 'text-critical', bg: 'bg-critical/10', dot: 'bg-critical' },
  warning: { text: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning' },
  info: { text: 'text-info', bg: 'bg-info/10', dot: 'bg-info' },
  operational: { text: 'text-operational', bg: 'bg-operational/10', dot: 'bg-operational' },
  neutral: { text: 'text-ink-muted', bg: 'bg-white/[0.04]', dot: 'bg-ink-muted' },
}

export function OpsSummaryBar({ items, className }: OpsSummaryBarProps) {
  return (
    <div className={cn('-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 no-scrollbar', className)}>
      {items.map((item, i) => {
        const tone = TONE_CLASS[item.tone] ?? TONE_CLASS.neutral
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2',
              tone.bg,
              'border-white/[0.06]',
            )}
          >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium leading-tight text-ink-muted">{item.label}</p>
              <p className={cn('text-sm font-semibold leading-snug', tone.text)}>{item.value}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
