import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActionCardProps {
  icon: LucideIcon
  label: string
  hint?: string
  onClick: () => void
  /** tile = grid 2x2 (hub); row = lista Acciones rápidas */
  variant?: 'tile' | 'row'
  className?: string
  disabled?: boolean
}

/** Acción rápida reutilizable (hub coordinador / dashboard voluntario). */
export function ActionCard({
  icon: Icon,
  label,
  hint,
  onClick,
  variant = 'tile',
  className,
  disabled,
}: ActionCardProps) {
  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
          'hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-info">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{label}</span>
          {hint ? <span className="block text-xs text-ink-subtle">{hint}</span> : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'glass rounded-3xl p-3 text-left transition-colors hover:bg-white/[0.09]',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      <Icon className="h-4.5 w-4.5 text-info" />
      <p className="mt-2 text-sm font-medium text-ink">{label}</p>
      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
    </button>
  )
}
