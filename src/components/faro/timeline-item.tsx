import { motion } from 'framer-motion'
import {
  Boxes,
  FileText,
  HeartHandshake,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'
import { STATUS } from '@/lib/status-config'
import type { ActivityEvent, ActivityKind } from '@/lib/types'

const KIND_ICON: Record<ActivityKind, typeof Boxes> = {
  inventory: Boxes,
  inventory_complete: PackageCheck,
  need_created: HeartHandshake,
  need_resolved: PackageCheck,
  need_reopened: RotateCcw,
  cycle_closed: RefreshCw,
  coordinator_approved: UserCheck,
  saturation: TrendingUp,
  report: FileText,
  request: HeartHandshake,
  resolved: PackageCheck,
  center_opened: ShieldCheck,
}

interface TimelineItemProps {
  event: ActivityEvent
  /** oculta la línea conectora en el último elemento */
  last?: boolean
  index?: number
}

/**
 * TimelineItem — actividad viva, no una lista. Línea conectora sutil,
 * punto semántico, jerarquía clara entre título y detalle.
 */
export function TimelineItem({ event, last, index = 0 }: TimelineItemProps) {
  const s = STATUS[event.status]
  const Icon = KIND_ICON[event.kind]

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: [0.32, 0.72, 0, 1] }}
      className="relative flex gap-3.5 pl-1"
    >
      {/* Conector */}
      {!last && <span className="absolute left-[22px] top-11 bottom-0 w-px bg-white/10" />}

      <span
        className={cn(
          'relative z-10 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset',
          s.bg,
          s.ring,
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', s.text)} strokeWidth={1.75} />
      </span>

      <div className="flex-1 pb-6">
        <p className="text-[14px] font-medium leading-snug text-ink">{event.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{event.detail}</p>
        <p className="mt-1 text-[11px] tracking-wide text-ink-faint">{timeAgo(event.at)}</p>
      </div>
    </motion.div>
  )
}
