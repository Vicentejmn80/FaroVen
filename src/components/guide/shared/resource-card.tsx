import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResourceCardProps {
  icon?: string
  title: string
  subtitle?: string
  onClick?: () => void
  index?: number
  accent?: 'default' | 'critical' | 'info' | 'operational'
  children?: React.ReactNode
  className?: string
}

const ACCENT_RING: Record<NonNullable<ResourceCardProps['accent']>, string> = {
  default: 'border-white/10',
  critical: 'border-critical/40',
  info: 'border-info/40',
  operational: 'border-operational/40',
}

export function ResourceCard({
  icon,
  title,
  subtitle,
  onClick,
  index = 0,
  accent = 'default',
  children,
  className,
}: ResourceCardProps) {
  const Tag = onClick ? motion.button : motion.div

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04, ease: [0.32, 0.72, 0, 1] }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn(
        'glass w-full rounded-3xl border p-4 text-left transition-colors',
        ACCENT_RING[accent],
        onClick && 'hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-ring',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="text-2xl leading-none">{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{title}</p>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
          {children}
        </div>
        {onClick && <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" />}
      </div>
    </Tag>
  )
}
