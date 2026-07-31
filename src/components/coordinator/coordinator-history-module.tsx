import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { buildCenterLogisticsHistory } from '@/services/logistics-history-service'
import { cn } from '@/lib/utils'

/**
 * Historial logístico automático: reservas, misiones y cierres del centro.
 */
export function CoordinatorHistoryModule() {
  const { assignment } = useCoordinatorAssignment()
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['logistics-history', assignment?.siteId],
    queryFn: () => buildCenterLogisticsHistory(assignment!.siteId),
    enabled: Boolean(assignment?.siteId),
    staleTime: 30_000,
  })

  const delivered = useMemo(
    () => rows.filter((r) => r.status === 'delivered' || r.status === 'completed' || r.status === 'released'),
    [rows],
  )

  if (!assignment?.siteId) return null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <History className="h-4 w-4 text-ink-muted" />
          Historial
        </h2>
        <p className="text-xs text-ink-subtle">Entregas, misiones y movimientos del centro</p>
      </div>

      {isLoading ? (
        <GlassCard className="h-24 animate-pulse" />
      ) : delivered.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-ink-muted">Sin historial todavía</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {delivered.slice(0, 30).map((r) => (
            <GlassCard key={r.id} className="!p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">
                    {r.at.toLocaleString('es-VE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-ink-muted">{r.subtitle}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    r.status === 'delivered' || r.status === 'completed'
                      ? 'bg-success/15 text-success'
                      : 'bg-white/[0.06] text-ink-muted',
                  )}
                >
                  {r.statusLabel}
                </span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
