import { GlassCard } from '@/components/ui/glass-card'
import { TrustIndicator } from './trust-indicator'
import { FreshnessBadge } from './freshness-badge'
import { ActivityLevelBadge } from './activity-level-badge'
import type { CenterTrustSnapshot } from '@/services/trust-service'
import { cn, timeAgo } from '@/lib/utils'

interface CenterTrustStripProps {
  snapshot: CenterTrustSnapshot
  compact?: boolean
  className?: string
}

/** Resumen contextual de confianza — responde quién, cuándo, qué tan confiable y si sigue vigente. */
export function CenterTrustStrip({ snapshot, compact = false, className }: CenterTrustStripProps) {
  return (
    <GlassCard className={cn('space-y-2.5', className)}>
      <FreshnessBadge freshness={snapshot.freshness} showTime={!compact} />
      <TrustIndicator
        score={snapshot.trust.score}
        label={snapshot.trust.label}
        updatedBy={snapshot.trust.updatedBy}
        compact={compact}
      />
      {!compact && (
        <p className="text-[11px] text-ink-subtle">
          Última actualización {timeAgo(snapshot.trust.lastUpdated)} · respaldada por{' '}
          {snapshot.trust.updatedBy}
        </p>
      )}
      <ActivityLevelBadge
        level={snapshot.activity.level}
        recentEventCount={snapshot.activity.recentEventCount}
      />
    </GlassCard>
  )
}
