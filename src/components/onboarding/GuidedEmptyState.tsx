import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

interface GuidedEmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  hint?: string
  className?: string
  action?: React.ReactNode
}

/** Estado vacío con orientación accionable — reemplaza mensajes genéricos. */
export function GuidedEmptyState({
  icon: Icon,
  title,
  description,
  hint,
  className,
  action,
}: GuidedEmptyStateProps) {
  return (
    <GlassCard inset={false} className={cn('space-y-3 p-4', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
            <Icon className="h-5 w-5 text-ink-faint" strokeWidth={1.75} />
          </span>
        )}
        <div>
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
        </div>
      </div>
      {hint && (
        <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs leading-relaxed text-ink-subtle">{hint}</p>
      )}
      {action}
    </GlassCard>
  )
}
