import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionTitleProps {
  children: ReactNode
  action?: ReactNode
  className?: string
}

/**
 * SectionTitle — encabezado de sección con jerarquía contenida.
 * Nunca compite con el saludo principal.
 */
export function SectionTitle({ children, action, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-center justify-between px-1', className)}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {children}
      </h2>
      {action}
    </div>
  )
}
