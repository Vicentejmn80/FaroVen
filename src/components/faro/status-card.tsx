import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/status-config'
import type { BlufMetric } from '@/lib/types'

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus }

/**
 * StatusCard — tarjeta BLUF pequeña. Un dato, un color, cero ruido.
 * Pensada para leerse de un vistazo dentro del resumen superior.
 */
export function StatusCard({ metric, index = 0 }: { metric: BlufMetric; index?: number }) {
  const s = STATUS[metric.status]
  const Trend = metric.trend ? TREND_ICON[metric.trend] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: [0.32, 0.72, 0, 1] }}
    >
      <GlassCard className="relative overflow-hidden p-3.5">
        <div className="flex items-start justify-between">
          <span className={cn('h-2 w-2 rounded-full', s.text)} style={{ backgroundColor: s.hex }} />
          {Trend && <Trend className={cn('h-3.5 w-3.5', s.text)} strokeWidth={2.5} />}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={metric.value}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="text-3xl font-semibold tracking-tight text-ink"
            >
              {metric.value}
            </motion.span>
          </AnimatePresence>
          {metric.unit && <span className="text-xs text-ink-subtle">{metric.unit}</span>}
        </div>
        <p className="mt-0.5 text-[13px] leading-tight text-ink-muted">{metric.label}</p>
      </GlassCard>
    </motion.div>
  )
}
