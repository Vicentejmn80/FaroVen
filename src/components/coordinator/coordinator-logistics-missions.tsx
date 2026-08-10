import { useMemo, useState } from 'react'
import { Truck } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useAdvanceCenterMission, useCenterReservations } from '@/hooks/useLogistics'
import { useMissions } from '@/hooks/useMissions'
import { getResourceLabel } from '@/lib/resource-catalog'
import { cn, timeAgo } from '@/lib/utils'
import {
  centerMissionStageLabel,
  getCenterMissionStage,
  type CenterMissionStage,
  type InventoryReservation,
} from '@/domain/center-operations.types'
import { cleanCaseTitle } from '@/components/operations-hub/case-ops-display'

const STAGES: CenterMissionStage[] = ['preparing', 'en_route', 'delivered']

/**
 * Misiones internas del centro (brigada / delivery).
 * Timeline simplificado: Preparando → En camino → Entregado.
 * No usa el modal de misión activa del voluntario.
 */
export function CoordinatorLogisticsMissions() {
  const { user, profile } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { data: reservations = [], isLoading } = useCenterReservations(assignment?.siteId)
  const { data: missions = [] } = useMissions()
  const advance = useAdvanceCenterMission()
  const [deliverModalId, setDeliverModalId] = useState<string | null>(null)
  const [deliverQty, setDeliverQty] = useState('0')

  const missionById = useMemo(() => {
    const map = new Map<string, (typeof missions)[number]>()
    for (const m of missions) map.set(m.id, m)
    return map
  }, [missions])

  const active = reservations.filter(
    (r) =>
      r.status === 'ready' &&
      (r.resolutionMode === 'brigade' || r.resolutionMode === 'delivery'),
  )
  const activeReservation = active.find((r) => r.id === deliverModalId) ?? null

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
        <h2 className="text-sm font-semibold text-ink">Misiones</h2>
        <p className="text-xs text-ink-subtle">
          Entregas que tu centro aceptó. Avanza el estado cuando tu brigada confirme.
        </p>
      </div>

      {active.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-subtle">No hay misiones activas</p>
          <p className="mt-1 text-xs text-ink-faint">
            Al aceptar una solicitud con brigada o delivery, aparece aquí.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {active.map((r) => (
            <MissionCard
              key={r.id}
              reservation={r}
              missionTitle={missionById.get(r.missionId)?.title}
              location={
                missionById.get(r.missionId)?.location?.address?.split(',')[0]?.trim() ||
                missionById.get(r.missionId)?.location?.zone
              }
              busy={advance.isPending}
              onAdvanceEnRoute={() => {
                if (!user?.id) return
                advance.mutate({
                  reservationId: r.id,
                  toStage: 'en_route',
                  actorId: user.id,
                })
              }}
              onMarkDelivered={() => {
                setDeliverModalId(r.id)
                setDeliverQty(String(r.quantity))
              }}
            />
          ))}
        </div>
      )}

      {activeReservation && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <GlassCard className="w-full max-w-md space-y-4 !p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Confirmar entrega
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {activeReservation.quantity} × {getResourceLabel(activeReservation.resourceType)}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                El Gestor de Casos será notificado para validar y cerrar el caso.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Cantidad entregada
              </label>
              <input
                type="number"
                min={1}
                max={activeReservation.quantity}
                value={deliverQty}
                onChange={(e) => setDeliverQty(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-ink"
              />
            </div>

            <div className="flex gap-2">
              <EmergencyButton
                variant="glass"
                size="sm"
                className="flex-1"
                disabled={advance.isPending}
                onClick={() => setDeliverModalId(null)}
              >
                Cancelar
              </EmergencyButton>
              <EmergencyButton
                variant="primary"
                size="sm"
                className="flex-1 !bg-operational"
                disabled={advance.isPending || !user?.id}
                onClick={() => {
                  const qty = Math.max(
                    1,
                    Math.min(activeReservation.quantity, Number(deliverQty) || 0),
                  )
                  advance.mutate(
                    {
                      reservationId: activeReservation.id,
                      toStage: 'delivered',
                      deliveredQuantity: qty,
                      actorId: user?.id,
                      actorName: profile?.full_name ?? user?.email ?? 'Coordinador',
                    },
                    { onSuccess: () => setDeliverModalId(null) },
                  )
                }}
              >
                {advance.isPending ? 'Guardando…' : 'Marcar entregado'}
              </EmergencyButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}

function MissionCard({
  reservation,
  missionTitle,
  location,
  busy,
  onAdvanceEnRoute,
  onMarkDelivered,
}: {
  reservation: InventoryReservation
  missionTitle?: string
  location?: string
  busy: boolean
  onAdvanceEnRoute: () => void
  onMarkDelivered: () => void
}) {
  const stage = getCenterMissionStage(reservation)
  const resourceLabel = getResourceLabel(reservation.resourceType)
  const headline = missionTitle
    ? cleanCaseTitle(missionTitle).headline || missionTitle
    : resourceLabel
  const dest = location || 'Destino'

  return (
    <GlassCard className="space-y-3 !border-operational/25 !p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Prioritario: {headline}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {reservation.quantity} u → {dest}
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          Estado
        </p>
        <ol className="space-y-1">
          {STAGES.map((s) => {
            const currentIdx = STAGES.indexOf(stage)
            const idx = STAGES.indexOf(s)
            const done = idx < currentIdx
            const current = idx === currentIdx
            return (
              <li
                key={s}
                className={cn(
                  'flex items-center gap-2 text-[13px]',
                  current && 'font-semibold text-ink',
                  done && 'text-ink-muted/80',
                  !done && !current && 'text-ink-faint/70',
                )}
              >
                <span aria-hidden>{done || current ? '●' : '○'}</span>
                {centerMissionStageLabel(s)}
                {current ? ' ←' : ''}
              </li>
            )
          })}
        </ol>
      </div>

      <p className="text-[11px] text-ink-faint">Actualizado {timeAgo(reservation.updatedAt)}</p>

      <div className="flex flex-col gap-2">
        {stage === 'preparing' && (
          <EmergencyButton
            variant="primary"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={onAdvanceEnRoute}
          >
            Avanzar a &quot;En camino&quot;
          </EmergencyButton>
        )}
        {(stage === 'preparing' || stage === 'en_route') && (
          <EmergencyButton
            variant={stage === 'en_route' ? 'primary' : 'glass'}
            size="sm"
            className={cn('w-full', stage === 'en_route' && '!bg-operational')}
            disabled={busy}
            onClick={onMarkDelivered}
          >
            Marcar entregado
          </EmergencyButton>
        )}
      </div>
    </GlassCard>
  )
}
