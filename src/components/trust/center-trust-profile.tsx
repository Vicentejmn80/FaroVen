import { ClipboardList, ShieldCheck } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { FreshnessBadge } from './freshness-badge'
import { TrustIndicator } from './trust-indicator'
import { VerificationBadge } from './verification-badge'
import type { CenterTrustSnapshot } from '@/services/trust-service'
import { cn, timeAgo } from '@/lib/utils'

interface CenterTrustProfileProps {
  snapshot: CenterTrustSnapshot
  className?: string
}

/** Perfil de confianza del centro — visible encima de necesidades. */
export function CenterTrustProfile({ snapshot, className }: CenterTrustProfileProps) {
  return (
    <GlassCard className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Confianza del centro
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Actualizado por{' '}
            <span className="font-medium text-ink">{snapshot.trust.updatedBy}</span>
          </p>
          <p className="text-xs text-ink-subtle">Hace {timeAgo(snapshot.trust.lastUpdated)}</p>
        </div>
        <VerificationBadge kind="coordinator" />
      </div>

      <FreshnessBadge freshness={snapshot.freshness} showTime />
      <TrustIndicator
        score={snapshot.trust.score}
        label={snapshot.trust.label}
        updatedBy={snapshot.trust.updatedBy}
      />

      <div className="grid grid-cols-2 gap-2">
        <ReportCountPill
          icon={ClipboardList}
          label="Pendientes"
          count={snapshot.reportCounts.pending}
          tone="warning"
        />
        <ReportCountPill
          icon={ShieldCheck}
          label="Verificados"
          count={snapshot.reportCounts.verified}
          tone="operational"
        />
      </div>
    </GlassCard>
  )
}

function ReportCountPill({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: typeof ClipboardList
  label: string
  count: number
  tone: 'warning' | 'operational'
}) {
  const toneClass = tone === 'warning' ? 'text-warning' : 'text-operational'
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{count}</p>
    </div>
  )
}
