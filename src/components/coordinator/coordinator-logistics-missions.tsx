import { useMemo, useState } from 'react'
import { CheckCircle2, Package, Truck } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useCenterReservations, useMarkReservationDelivered } from '@/hooks/useLogistics'
import { useMissions } from '@/hooks/useMissions'
import { getResourceLabel } from '@/lib/resource-catalog'
import { cn, timeAgo } from '@/lib/utils'
import type { InventoryReservationStatus } from '@/domain/center-operations.types'

const PIPELINE: Array<{ id: InventoryReservationStatus | 'preparing'; label: string }> = [
  { id: 'preparing', label: 'Preparando' },
  { id: 'ready', label: 'Listo para retirar' },
  { id: 'delivered', label: 'Entregado' },
]

/**
 * Misiones logísticas activas en el centro.
 * Pipeline existente: ready → delivered (tras Preparar desde Solicitudes).
 */
export function CoordinatorLogisticsMissions() {
  const { user, profile } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { data: reservations = [], isLoading } = useCenterReservations(assignment?.siteId)
  const { data: missions = [] } = useMissions()
  const markDelivered = useMarkReservationDelivered()
  const [deliverModalId, setDeliverModalId] = useState<string | null>(null)
  const [deliverQty, setDeliverQty] = useState<string>('0')

  const missionById = useMemo(() => {
    const map = new Map<string, (typeof missions)[number]>()
    for (const m of missions) map.set(m.id, m)
    return map
  }, [missions])

  const active = reservations.filter((r) => r.status === 'ready')
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
        <h2 className="text-sm font-semibold text-ink">Misiones en curso</h2>
        <p className="text-xs text-ink-subtle">
          Recursos preparados — espera retiro del voluntario y confirma entrega.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {PIPELINE.map((step, idx) => (
          <div
            key={step.id}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-1 py-2"
          >
            <span className="text-[10px] font-medium text-ink-faint">{idx + 1}</span>
            <span className="text-center text-[10px] leading-tight text-ink-muted">{step.label}</span>
          </div>
        ))}
      </div>

      {active.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-subtle">No hay misiones activas</p>
          <p className="mt-1 text-xs text-ink-faint">
            Al preparar una solicitud, aparece aquí como “Listo para retirar”.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {active.map((r) => {
            const mission = missionById.get(r.missionId)
            return (
              <GlassCard key={r.id} className="space-y-3 !border-operational/25 !p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {mission?.title ?? `Caso ${r.caseId.slice(0, 8)}`}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {r.quantity} × {getResourceLabel(r.resourceType)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-operational/15 px-2 py-0.5 text-[10px] font-medium text-operational">
                    Listo para retirar
                  </span>
                </div>

                <PipelineDots current="ready" />

                <p className="text-[11px] text-ink-faint">Preparado {timeAgo(r.updatedAt)}</p>

                <EmergencyButton
                  variant="primary"
                  size="md"
                  className="w-full !bg-operational"
                  disabled={markDelivered.isPending || !user?.id}
                  onClick={() => {
                    setDeliverModalId(r.id)
                    setDeliverQty(String(r.quantity))
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Marcar entregado
                </EmergencyButton>
              </GlassCard>
            )
          })}
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
                Indica cuánto se entregó realmente (si fue parcial).
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
              <p className="text-[11px] text-ink-faint">
                Máximo: {activeReservation.quantity}
              </p>
            </div>

            <div className="flex gap-2">
              <EmergencyButton
                variant="glass"
                size="sm"
                className="flex-1"
                disabled={markDelivered.isPending}
                onClick={() => setDeliverModalId(null)}
              >
                Cancelar
              </EmergencyButton>
              <EmergencyButton
                variant="primary"
                size="sm"
                className="flex-1 !bg-operational"
                disabled={markDelivered.isPending || !user?.id}
                onClick={() => {
                  const qty = Math.max(1, Math.min(activeReservation.quantity, Number(deliverQty) || 0))
                  markDelivered.mutate(
                    {
                      reservationId: activeReservation.id,
                      deliveredQuantity: qty,
                      actorId: user?.id,
                      actorName: profile?.full_name ?? user?.email ?? 'Coordinador',
                    },
                    { onSuccess: () => setDeliverModalId(null) },
                  )
                }}
              >
                {markDelivered.isPending ? 'Guardando…' : 'Confirmar'}
              </EmergencyButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}

function PipelineDots({ current }: { current: 'preparing' | 'ready' | 'delivered' }) {
  const order = ['preparing', 'ready', 'delivered'] as const
  const idx = order.indexOf(current)
  return (
    <div className="flex items-center gap-1.5">
      {order.map((step, i) => (
        <div key={step} className="flex flex-1 items-center gap-1.5">
          <span
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i <= idx ? 'bg-operational' : 'bg-white/[0.08]',
            )}
          />
          {i === 0 && <Package className="h-3 w-3 text-ink-faint" />}
        </div>
      ))}
    </div>
  )
}
