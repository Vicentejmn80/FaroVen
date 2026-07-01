import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'

interface FlowSheetProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

/** Hoja modal a pantalla completa — mismo lenguaje que ActionsScreen. */
export function FlowSheet({ title, subtitle, onClose, children }: FlowSheetProps) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      className="absolute inset-0 z-[60] flex flex-col bg-base-900/95 backdrop-blur-2xl lg:rounded-2xl"
    >
      <div className="flex flex-col items-center px-5 pt-safe">
        <EmergencyButton variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" className="mt-2">
          <ChevronDown className="h-6 w-6" />
        </EmergencyButton>
        <div className="w-full px-1 pb-3">
          {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
          <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-32">{children}</div>
    </motion.div>
  )
}

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
}

export function FormField({ label, children, hint }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
    </label>
  )
}

export const fieldClassName =
  'h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none transition-colors focus:border-info/60'

export const textareaClassName =
  'min-h-[100px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-info/60'

export function TypePills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            value === option.value
              ? 'min-h-11 rounded-2xl border border-info/60 bg-info-soft px-2 text-sm font-medium text-ink'
              : 'min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-2 text-sm text-ink-muted'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
