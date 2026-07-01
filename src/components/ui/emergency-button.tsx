import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold select-none transition-colors duration-200 ease-apple disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-ring',
  {
    variants: {
      variant: {
        primary: 'bg-info text-white shadow-focal hover:bg-info/90',
        glass: 'glass text-ink hover:bg-white/10',
        critical: 'bg-critical text-white hover:bg-critical/90',
        ghost: 'text-ink-muted hover:text-ink hover:bg-white/5',
      },
      size: {
        sm: 'h-10 px-4 text-sm rounded-xl',
        md: 'h-12 px-5 text-[15px] rounded-2xl',
        lg: 'h-14 px-6 text-base rounded-2xl',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: { variant: 'glass', size: 'md' },
  },
)

export interface EmergencyButtonProps
  extends HTMLMotionProps<'button'>,
    VariantProps<typeof buttonVariants> {}

/**
 * EmergencyButton — botón táctil con microinteracción Apple (tap = scale 0.97).
 * Mínimo 44px de área. Variantes semánticas.
 */
export const EmergencyButton = forwardRef<HTMLButtonElement, EmergencyButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)
EmergencyButton.displayName = 'EmergencyButton'

export { buttonVariants }
