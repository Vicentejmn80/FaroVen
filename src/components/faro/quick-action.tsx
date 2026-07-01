import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OperationalStatus } from '@/lib/types'
import { STATUS } from '@/lib/status-config'

interface QuickActionProps {
  icon: LucideIcon
  label: string
  hint?: string
  accent?: OperationalStatus
  onClick?: () => void
  index?: number
}

/**
 * QuickAction — botón grande y táctil para "¿Qué necesitas hacer?".
 * Glassmorphism, mucho aire, icono fino. Ayuda a actuar sin pensar.
 */
export function QuickAction({ icon: Icon, label, hint, accent = 'info', onClick, index = 0 }: QuickActionProps) {
  const s = STATUS[accent]
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: [0.32, 0.72, 0, 1] }}
      whileTap={{ scale: 0.97 }}
      className="glass group flex h-full w-full flex-col items-start gap-3 rounded-3xl p-4 text-left transition-colors duration-200 ease-apple hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-ring"
    >
      <span
        className={cn('flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset', s.bg, s.ring)}
      >
        <Icon className={cn('h-5 w-5', s.text)} strokeWidth={1.75} />
      </span>
      <span className="space-y-0.5">
        <span className="block text-[15px] font-semibold leading-tight text-ink">{label}</span>
        {hint && <span className="block text-xs leading-snug text-ink-subtle">{hint}</span>}
      </span>
    </motion.button>
  )
}
