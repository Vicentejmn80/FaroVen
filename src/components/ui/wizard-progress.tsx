import { cn } from '@/lib/utils'

interface WizardProgressProps {
  step: number
  total: number
  className?: string
}

export function WizardProgress({ step, total, className }: WizardProgressProps) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-subtle">
          Paso {step} de {total}
        </span>
        <span className="text-ink-faint">{pct}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-info transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
