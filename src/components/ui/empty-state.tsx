import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, className, action }: EmptyStateProps) {
  return (
    <GlassCard className={cn('flex flex-col items-center py-8 text-center', className)}>
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]">
          <Icon className="h-5 w-5 text-ink-faint" strokeWidth={1.75} />
        </span>
      )}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-[32ch] text-sm leading-relaxed text-ink-subtle">{description}</p>}
      {action && <div className="mt-4 w-full">{action}</div>}
    </GlassCard>
  )
}
