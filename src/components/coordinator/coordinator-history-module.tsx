import { GlassCard } from '@/components/ui/glass-card'
import { TimelineItem } from '@/components/faro/timeline-item'
import { SectionHeader } from '@/components/coordinator/section-header'
import { useCoordinatorHistory, useCoordinatorSite } from '@/hooks/useCoordinatorPanel'
import { useInventoryMovements } from '@/hooks/useCenterOperations'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { toActivityEvent } from '@/services/faro-service'
import { eventActionLabel, eventActorLabel } from '@/services/coordinator-service'
import { getResourceLabel } from '@/lib/resource-catalog'
import { cn, timeAgo } from '@/lib/utils'
import { History } from 'lucide-react'

const REASON_LABEL: Record<string, string> = {
  donation: 'Donación',
  dispatch: 'Salida',
  mission: 'Misión',
  adjustment: 'Ajuste',
  intake: 'Entrada',
  outflow: 'Salida',
}

/**
 * Historial simple: movimientos de inventario + hitos operativos.
 */
export function CoordinatorHistoryModule() {
  const site = useCoordinatorSite()
  const { assignment } = useCoordinatorAssignment()
  const events = useCoordinatorHistory()
  const { data: movements = [] } = useInventoryMovements(assignment?.siteId ?? '')

  if (!site) return null

  const inventoryRows = movements.map((m) => ({
    id: `inv-${m.id}`,
    at: m.createdAt,
    sign: m.delta >= 0 ? '+' : '',
    title: `${m.delta >= 0 ? '+' : ''}${m.delta} ${getResourceLabel(m.resourceType)}`,
    detail: m.sourceLabel || REASON_LABEL[m.reason] || m.reason,
    positive: m.delta >= 0,
  }))

  const activity = events.map((event) => {
    const base = toActivityEvent(event, site.name)
    return {
      ...base,
      title: eventActionLabel(event),
      detail: `${event.detail} · ${eventActorLabel(event)}`,
    }
  })

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Historial"
        subtitle="Entradas, salidas, donaciones y misiones"
        icon={History}
      />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Inventario</p>
        {inventoryRows.length === 0 ? (
          <GlassCard className="p-4 text-sm text-ink-muted">Sin movimientos de inventario.</GlassCard>
        ) : (
          inventoryRows.map((row) => (
            <GlassCard key={row.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold tabular-nums', row.positive ? 'text-operational' : 'text-warning')}>
                  {row.title}
                </p>
                <p className="text-xs text-ink-subtle">{row.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(row.at)}</span>
            </GlassCard>
          ))
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Operaciones</p>
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
    </div>
  )
}
