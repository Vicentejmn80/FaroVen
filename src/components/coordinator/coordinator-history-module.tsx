import { GlassCard } from '@/components/ui/glass-card'
import { TimelineItem } from '@/components/faro/timeline-item'
import { useCoordinatorHistory } from '@/hooks/useCoordinatorPanel'
import { toActivityEvent } from '@/services/faro-service'
import { eventActionLabel, eventActorLabel } from '@/services/coordinator-service'
import { useCoordinatorSite } from '@/hooks/useCoordinatorPanel'
import { timeAgo } from '@/lib/utils'

export function CoordinatorHistoryModule() {
  const site = useCoordinatorSite()
  const events = useCoordinatorHistory()

  if (!site) return null

  const activity = events.map((event) => {
    const base = toActivityEvent(event, site.name)
    return {
      ...base,
      title: eventActionLabel(event),
      detail: `${event.detail} · ${eventActorLabel(event)}`,
    }
  })

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink">Historial del centro</p>
      <p className="text-xs text-ink-subtle">
        Línea de tiempo con donaciones, necesidades, saturación y reportes revisados.
      </p>
      <GlassCard inset={false} className="p-3">
        {activity.length === 0 ? (
          <p className="text-sm text-ink-muted">Aún no hay eventos registrados para este centro.</p>
        ) : (
          activity.map((evt, i) => (
            <TimelineItem
              key={evt.id}
              event={{ ...evt, detail: `${evt.detail} · ${timeAgo(evt.at)}` }}
              index={i}
              last={i === activity.length - 1}
            />
          ))
        )}
      </GlassCard>
    </div>
  )
}
