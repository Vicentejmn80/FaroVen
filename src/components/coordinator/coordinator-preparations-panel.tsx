import { useMemo } from 'react'
import { Package, User, MapPin, Clock, CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import {
  useCenterReservations,
  useMarkReservationReady,
  useMarkReservationDelivered,
} from '@/hooks/useLogistics'
import { useMissions } from '@/hooks/useMissions'
import { getResourceLabel } from '@/lib/resource-catalog'
import { timeAgo } from '@/lib/utils'
import type { InventoryReservation } from '@/domain/center-operations.types'

/**
 * Panel del coordinador: preparaciones de recursos solicitadas por el GC.
 * Flujo simple por estados: reserved → ready → delivered.
 */
export function CoordinatorPreparationsPanel() {
  const { user, profile } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { data: reservations = [], isLoading } = useCenterReservations(assignment?.siteId)
  const { data: missions = [] } = useMissions()
  const markReady = useMarkReservationReady()
  const markDelivered = useMarkReservationDelivered()

  const missionById = useMemo(() => {
    const map = new Map<string, (typeof missions)[number]>()
    for (const m of missions) map.set(m.id, m)
    return map
  }, [missions])

  const busy = markReady.isPending || markDelivered.isPending
  const actorName = profile?.full_name ?? user?.email ?? 'Coordinador'

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

  const active = reservations.filter((r) => r.status === 'reserved' || r.status === 'ready')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Preparación de recursos</h2>
        <p className="text-xs text-ink-subtle">
          Misiones logísticas que recogerán inventario en {assignment.siteName}
        </p>
      </div>

      {active.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-subtle">No hay preparaciones pendientes</p>
          <p className="mt-1 text-xs text-ink-faint">
            Cuando el Gestor de Casos asigne una misión de recursos a tu centro, aparecerá aquí.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {active.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              mission={missionById.get(reservation.missionId)}
              busy={busy}
              onReady={() =>
                markReady.mutate({ reservationId: reservation.id, actorId: user?.id })
              }
              onDelivered={() =>
                markDelivered.mutate({
                  reservationId: reservation.id,
                  actorId: user?.id,
                  actorName,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReservationCard({
  reservation,
  mission,
  busy,
  onReady,
  onDelivered,
}: {
  reservation: InventoryReservation
  mission?: { title: string; location: { zone?: string; address?: string } }
  busy: boolean
  onReady: () => void
  onDelivered: () => void
}) {
  const isReady = reservation.status === 'ready'
  const statusLabel = isReady ? 'Preparado' : 'Pendiente de preparación'

  return (
    <GlassCard className="space-y-3 border-info/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {reservation.quantity} × {getResourceLabel(reservation.resourceType)}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            Misión: {mission?.title ?? reservation.missionId.slice(0, 8)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            isReady ? 'bg-operational/15 text-operational' : 'bg-warning/15 text-warning'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-ink-muted">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-ink-faint" />
          <span>Voluntario asignado (se notifica al aceptar)</span>
        </div>
        {mission?.location?.zone && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-ink-faint" />
            <span>Destino: {mission.location.address ?? mission.location.zone}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-ink-faint" />
          <span>Solicitado {timeAgo(reservation.createdAt)}</span>
        </div>
      </div>

      <div className="pt-1">
        {!isReady ? (
          <EmergencyButton
            variant="primary"
            size="md"
            className="w-full"
            disabled={busy}
            onClick={onReady}
          >
            <CheckCircle2 className="h-4 w-4" />
            Marcar como preparado
          </EmergencyButton>
        ) : (
          <EmergencyButton
            variant="primary"
            size="md"
            className="w-full !bg-operational"
            disabled={busy}
            onClick={onDelivered}
          >
            <Package className="h-4 w-4" />
            Entregar al voluntario
          </EmergencyButton>
        )}
        {isReady && (
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            Marca “Entregar” cuando el voluntario llegue y recoja los recursos.
          </p>
        )}
      </div>
    </GlassCard>
  )
}
