import { CheckCircle2, Clock, MapPin } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { GuidedEmptyState } from '@/components/onboarding/GuidedEmptyState'
import { useSuccessCases } from '@/hooks/usePublicNeeds'
import { cn } from '@/lib/utils'

interface SuccessCasesPanelProps {
  className?: string
  title?: string
  emptyTitle?: string
  emptyDescription?: string
  limit?: number
}

export function SuccessCasesPanel({
  className,
  title = 'Casos de éxito',
  emptyTitle = 'Aún no hay casos de éxito',
  emptyDescription = 'Cuando una misión se complete y valide, aparecerá aquí como referencia para la red.',
  limit = 20,
}: SuccessCasesPanelProps) {
  const { data: cases = [], isLoading } = useSuccessCases(limit)

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2].map((i) => (
          <GlassCard key={i} className="h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <GuidedEmptyState
        className={className}
        icon={CheckCircle2}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {cases.map((item) => (
        <GlassCard key={item.id} className="border-l-2 border-operational/60 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{item.helpType}</p>
              <p className="mt-1 text-xs text-ink-muted line-clamp-2">{item.impactSummary}</p>
            </div>
            <span className="shrink-0 rounded-full bg-operational/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-operational">
              {item.publicCode}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-subtle">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.zone}
            </span>
            {item.totalDurationMinutes != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.totalDurationMinutes < 60
                  ? `${item.totalDurationMinutes} min`
                  : `${(item.totalDurationMinutes / 60).toFixed(1)} h`}
              </span>
            )}
            <span>{item.verifiedAt.toLocaleDateString('es-VE')}</span>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}
