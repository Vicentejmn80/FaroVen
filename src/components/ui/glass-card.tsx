import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** material más sólido para paneles que flotan sobre el mapa */
  strong?: boolean
  /** padding interno por defecto */
  inset?: boolean
}

/**
 * GlassCard — superficie base de FARO. Glassmorphism muy sutil,
 * blur ligero, borde fino. Es el contenedor de casi todo.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, strong, inset = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-3xl shadow-glass-sm',
        inset && 'p-4',
        className,
      )}
      {...props}
    />
  ),
)
GlassCard.displayName = 'GlassCard'
