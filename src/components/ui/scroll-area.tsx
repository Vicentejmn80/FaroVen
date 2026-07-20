import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Altura máxima (p. ej. max-h-[420px]). Si no se pasa, usa flex-1 overflow. */
  maxHeightClassName?: string
}

/** Contenedor scrollable consistente (equivalente ligero a ScrollArea). */
export function ScrollArea({
  children,
  className,
  maxHeightClassName = 'max-h-[420px]',
  ...props
}: ScrollAreaProps) {
  return (
    <div
      className={cn('no-scrollbar overflow-y-auto overscroll-contain', maxHeightClassName, className)}
      {...props}
    >
      {children}
    </div>
  )
}
