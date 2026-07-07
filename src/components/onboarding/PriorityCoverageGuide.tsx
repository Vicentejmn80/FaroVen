import { cn } from '@/lib/utils'
import { COVERAGE_EXPLANATION, PRIORITY_LEVELS } from '@/lib/onboarding-content'

interface PriorityCoverageGuideProps {
  compact?: boolean
  className?: string
}

/** Leyenda de prioridades y cobertura — reutilizable en onboarding y mapa. */
export function PriorityCoverageGuide({ compact = false, className }: PriorityCoverageGuideProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {PRIORITY_LEVELS.map((level) => (
          <div
            key={level.id}
            className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: level.color }}
              aria-hidden
            />
            <div>
              <p className="text-xs font-medium text-ink">{level.label}</p>
              {!compact && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-subtle">{level.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-ink-subtle">{COVERAGE_EXPLANATION}</p>
    </div>
  )
}
