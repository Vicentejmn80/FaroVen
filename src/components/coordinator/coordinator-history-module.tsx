import { useMemo } from 'react'
import { History } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useCenterReservations } from '@/hooks/useLogistics'
import { useMissions } from '@/hooks/useMissions'
import { getResourceLabel } from '@/lib/resource-catalog'
import { cn } from '@/lib/utils'

/**
 * Historial logístico: solo cierres de preparación (fecha, caso, recurso, cantidad, estado).
 */
export function CoordinatorHistoryModule() {
  const { assignment } = useCoordinatorAssignment()
  const { data: reservations = [], isLoading } = useCenterReservations(assignment?.siteId)
  const { data: missions = [] } = useMissions()

  const missionById = useMemo(() => {
    const map = new Map<string, (typeof missions)[number]>()
    for (const m of missions) map.set(m.id, m)
    return map
  }, [missions])

  const rows = useMemo(
    () =>
      reservations
        .filter((r) => r.status === 'delivered' || r.status === 'released' || r.status === 'cancelled')
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [reservations],
  )

  if (!assignment?.siteId) return null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <History className="h-4 w-4 text-ink-muted" />
          Historial
        </h2>
        <p className="text-xs text-ink-subtle">Entregas y cierres de solicitudes del GC</p>
      </div>

      {isLoading ? (
        <GlassCard className="h-24 animate-pulse" />
      ) : rows.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-ink-muted">Sin historial todavía</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const mission = missionById.get(r.missionId)
            const statusLabel =
              r.status === 'delivered'
                ? 'Finalizado'
                : r.status === 'released'
                  ? 'Liberado'
                  : 'Cancelado'
            return (
              <GlassCard key={r.id} className="!p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-faint">
                      {r.updatedAt.toLocaleString('es-VE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">
                      {mission?.title ?? `Caso ${r.caseId.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {r.quantity} × {getResourceLabel(r.resourceType)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      r.status === 'delivered'
                        ? 'bg-operational/15 text-operational'
                        : 'bg-white/[0.06] text-ink-muted',
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
