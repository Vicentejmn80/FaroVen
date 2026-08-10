import { cn } from '@/lib/utils'
import type { CaseDomainEvent } from '@/domain/case-lifecycle.types'
import type { MissionEvent } from '@/domain/mission.types'
import { buildAuditTimeline } from '@/components/dispatch/live-mission-audit-timeline'

interface CaseDetailTimelineProps {
  caseEvents?: CaseDomainEvent[]
  missionEvents?: MissionEvent[]
  className?: string
}

function formatClock(d: Date): string {
  try {
    return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/** Timeline cronológico ascendente para la ficha operativa del GC. */
export function CaseDetailTimeline({
  caseEvents = [],
  missionEvents = [],
  className,
}: CaseDetailTimelineProps) {
  const items = buildAuditTimeline({ caseEvents, missionEvents }).sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  )

  if (items.length === 0) {
    return (
      <p className="text-[12px] text-ink-faint">Sin eventos registrados aún.</p>
    )
  }

  const latestId = items[items.length - 1]?.id

  return (
    <ol className={cn('space-y-0', className)}>
      {items.map((item, index) => {
        const isLatest = item.id === latestId
        const isDelay = item.title.toLowerCase().includes('retraso') || item.icon === '⌛'
        return (
          <li
            key={item.id}
            className={cn(
              'relative flex gap-2.5 pb-3',
              isLatest &&
                'rounded-lg border border-info/20 bg-info/[0.06] px-2 py-2 -mx-2 mb-1',
            )}
          >
            {index < items.length - 1 && (
              <span
                className="absolute left-[22px] top-7 bottom-0 w-px bg-white/[0.08]"
                aria-hidden
              />
            )}
            <span
              className={cn(
                'w-11 shrink-0 pt-0.5 text-right text-[11px] tabular-nums',
                isLatest ? 'font-semibold text-ink' : 'text-ink-muted',
              )}
            >
              {formatClock(item.at)}
            </span>
            <span className="w-5 shrink-0 text-center text-sm leading-none" aria-hidden>
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-[13px] leading-snug',
                  isLatest ? 'font-semibold text-ink' : 'text-ink/90',
                  isDelay && 'text-warning',
                )}
              >
                {isDelay && !item.title.startsWith('⏱️') ? `⏱️ ${item.title}` : item.title}
              </p>
              {item.detail && (
                <p className="mt-0.5 text-[11px] text-ink-muted/70">{item.detail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
