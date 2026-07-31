import { useMemo } from 'react'
import { ClipboardList, Clock, MapPin, Package } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useCenterReservations, useMarkReservationReady } from '@/hooks/useLogistics'
import { useMissions } from '@/hooks/useMissions'
import { getResourceLabel } from '@/lib/resource-catalog'
import { timeAgo } from '@/lib/utils'

/**
 * Solicitudes del GC → preparar recursos.
 * Solo reservas en estado `reserved` (pipeline logístico existente).
 */
export function CoordinatorLogisticsRequests({ onPrepared }: { onPrepared?: () => void }) {
  const { user } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { data: reservations = [], isLoading } = useCenterReservations(assignment?.siteId)
  const { data: missions = [] } = useMissions()
  const markReady = useMarkReservationReady()

  const missionById = useMemo(() => {
    const map = new Map<string, (typeof missions)[number]>()
    for (const m of missions) map.set(m.id, m)
    return map
  }, [missions])

  const requests = reservations.filter((r) => r.status === 'reserved')

  if (!assignment?.siteId) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-ink-subtle">No tienes un centro asignado.</p>
      </GlassCard>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <GlassCard key={i} className="h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Solicitudes del Gestor</h2>
        <p className="text-xs text-ink-subtle">
          Recursos pedidos para misiones. Prepáralos y pasan a Misiones.
        </p>
      </div>

      {requests.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-subtle">Sin solicitudes pendientes</p>
          <p className="mt-1 text-xs text-ink-faint">
            Cuando el GC asigne inventario de tu centro a una misión, aparecerá aquí.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const mission = missionById.get(r.missionId)
            const eta = mission?.eta ? new Date(mission.eta) : null
            return (
              <GlassCard key={r.id} className="space-y-3 !p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {mission?.title ?? `Caso ${r.caseId.slice(0, 8)}`}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {r.quantity} × {getResourceLabel(r.resourceType)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                    Pendiente
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-ink-faint">
                  {mission?.location?.zone && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {mission.location.address ?? mission.location.zone}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {eta && !Number.isNaN(eta.getTime())
                      ? `ETA voluntario · ${eta.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`
                      : `Solicitado ${timeAgo(r.createdAt)}`}
                  </p>
                </div>

                <EmergencyButton
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={markReady.isPending || !user?.id}
                  onClick={() =>
                    markReady.mutate(
                      { reservationId: r.id, actorId: user?.id },
                      { onSuccess: () => onPrepared?.() },
                    )
                  }
                >
                  <Package className="h-4 w-4" />
                  Preparar recursos
                </EmergencyButton>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
