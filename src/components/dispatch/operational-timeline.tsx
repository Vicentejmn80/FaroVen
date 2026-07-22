import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Check, Circle, Loader2 } from 'lucide-react'

export interface TimelineStep {
  id: string
  label: string
  timestamp?: string
  completed: boolean
  active: boolean
  metadata?: string
}

export function OperationalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="relative space-y-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        return (
          <div key={step.id} className="relative flex gap-3 pb-6">
            {!isLast && (
              <div className={cn(
                'absolute left-[11px] top-6 w-px h-full',
                step.completed ? 'bg-operational/40' : 'bg-white/[0.06]',
              )} />
            )}
            <div className="relative flex shrink-0 flex-col items-center pt-0.5">
              <motion.div
                initial={step.active ? { scale: 0.8 } : undefined}
                animate={step.active ? { scale: [0.8, 1.1, 1] } : undefined}
                transition={{ duration: 0.3 }}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  step.completed ? 'bg-operational/20 text-operational' : step.active ? 'bg-info/20 text-info' : 'bg-white/[0.06] text-ink-faint',
                )}>
                {step.completed ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : step.active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-3 w-3" strokeWidth={1.5} />
                )}
              </motion.div>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn(
                'text-sm font-medium',
                step.completed ? 'text-ink' : step.active ? 'text-info' : 'text-ink-muted',
              )}>{step.label}</p>
              {(step.timestamp || step.metadata) && (
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
                  {step.timestamp && <span>{step.timestamp}</span>}
                  {step.metadata && <span>{step.metadata}</span>}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
