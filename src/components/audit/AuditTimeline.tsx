import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuditSemanticTone, HumanizedAuditEntry } from '@/services/audit-label-service'
import { cn } from '@/lib/utils'

interface AuditTimelineProps {
  entries: HumanizedAuditEntry[]
  loading?: boolean
  emptyMessage?: string
}

const TONE_RING: Record<AuditSemanticTone, string> = {
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-operational/30 bg-operational/10 text-operational',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  critical: 'border-critical/30 bg-critical/10 text-critical',
  neutral: 'border-white/10 bg-white/[0.06] text-ink-subtle',
}

function formatTimelineDate(iso: string): { date: string; time: string } {
  const value = new Date(iso)
  return {
    date: value.toLocaleDateString('es-VE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
    time: value.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

export function AuditTimeline({
  entries,
  loading,
  emptyMessage = 'Sin eventos de auditoría.',
}: AuditTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-3xl" />
      </div>
    )
  }

  if (entries.length === 0) {
    return <GlassCard className="text-sm text-ink-muted">{emptyMessage}</GlassCard>
  }

  return (
    <ol className="relative space-y-0">
      <span
        aria-hidden
        className="absolute bottom-2 left-[19px] top-2 w-px bg-gradient-to-b from-white/15 via-white/10 to-transparent"
      />
      {entries.map((entry) => {
        const Icon = entry.icon
        const { date, time } = formatTimelineDate(entry.createdAt)
        const ring = TONE_RING[entry.tone]

        return (
          <li key={entry.id} className="relative pb-3 pl-11">
            <span
              className={cn(
                'absolute left-2 top-3 flex h-9 w-9 items-center justify-center rounded-full border',
                ring,
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>

            <GlassCard className="space-y-1.5 transition-colors hover:bg-white/[0.06]">
              <p className="text-sm leading-snug text-ink">{entry.message}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-subtle">
                <span>{entry.actor}</span>
                {entry.centerName && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{entry.centerName}</span>
                  </>
                )}
                <span aria-hidden>·</span>
                <span>{time}</span>
                <span aria-hidden>·</span>
                <span>{date}</span>
              </div>
            </GlassCard>
          </li>
        )
      })}
    </ol>
  )
}
