import { useMemo, useState } from 'react'
import { ClipboardList, Clock, MapPin, Package } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import {
  useAcceptVolunteerInventoryReservation,
  useCenterReservations,
  useRespondToInventoryRequest,
} from '@/hooks/useLogistics'
import { useMissions } from '@/hooks/useMissions'
import { getResourceLabel } from '@/lib/resource-catalog'
import { cn, timeAgo } from '@/lib/utils'
import type { CenterResolutionMode, InventoryReservation } from '@/domain/center-operations.types'

type ResolutionStep = 'choose' | 'details'

/**
 * Solicitudes del GC → respuesta operativa del centro.
 * Flujo: ¿cómo resolverá? → brigada | delivery | necesita voluntario.
 */
export function CoordinatorLogisticsRequests({ onPrepared }: { onPrepared?: () => void }) {
  const { user } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { data: reservations = [], isLoading } = useCenterReservations(assignment?.siteId)
  const { data: missions = [] } = useMissions()
  const respond = useRespondToInventoryRequest()
  const acceptVolunteer = useAcceptVolunteerInventoryReservation()
  const [activeId, setActiveId] = useState<string | null>(null)

  const missionById = useMemo(() => {
    const map = new Map<string, (typeof missions)[number]>()
    for (const m of missions) map.set(m.id, m)
    return map
  }, [missions])

  const volunteerPending = reservations.filter(
    (r) => r.status === 'reserved' && Boolean(r.volunteerUserId) && !r.resolutionMode,
  )
  const requests = reservations.filter(
    (r) => r.status === 'reserved' && !r.resolutionMode && !r.volunteerUserId,
  )

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

  const active = requests.find((r) => r.id === activeId) ?? null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Solicitudes del Gestor</h2>
        <p className="text-xs text-ink-subtle">
          Indica cómo resolverá tu centro cada solicitud del GC.
        </p>
      </div>

      {volunteerPending.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-operational">
            Reservas de voluntarios
          </p>
          {volunteerPending.map((r) => {
            const mission = missionById.get(r.missionId)
            const expiresMin =
              r.expiresAt != null
                ? Math.max(0, Math.ceil((r.expiresAt.getTime() - Date.now()) / 60000))
                : null
            return (
              <GlassCard key={r.id} className="space-y-3 !border-operational/25 !p-4">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {mission?.title ?? `Misión ${r.missionId.slice(0, 8)}`}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Reservó {r.quantity} × {getResourceLabel(r.resourceType)}
                    {expiresMin != null ? ` · expira en ${expiresMin}m` : ''}
                  </p>
                </div>
                <EmergencyButton
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={acceptVolunteer.isPending}
                  onClick={() => void acceptVolunteer.mutateAsync(r.id)}
                >
                  Aceptar reserva
                </EmergencyButton>
              </GlassCard>
            )
          })}
        </div>
      )}

      {requests.length === 0 && volunteerPending.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-subtle">Sin solicitudes pendientes</p>
          <p className="mt-1 text-xs text-ink-faint">
            Cuando el GC asigne inventario de tu centro a una misión, aparecerá aquí.
          </p>
        </GlassCard>
      ) : requests.length === 0 ? null : (
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
                      ? `ETA · ${eta.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`
                      : `Solicitado ${timeAgo(r.createdAt)}`}
                  </p>
                </div>

                <EmergencyButton
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={!user?.id}
                  onClick={() => setActiveId(r.id)}
                >
                  <Package className="h-4 w-4" />
                  Responder solicitud
                </EmergencyButton>
              </GlassCard>
            )
          })}
        </div>
      )}

      {active && user?.id && (
        <ResolutionModal
          reservation={active}
          missionTitle={missionById.get(active.missionId)?.title}
          busy={respond.isPending}
          onClose={() => setActiveId(null)}
          onConfirm={async (payload) => {
            await respond.mutateAsync({
              reservationId: active.id,
              actorId: user.id,
              ...payload,
            })
            setActiveId(null)
            onPrepared?.()
          }}
        />
      )}
    </div>
  )
}

function ResolutionModal({
  reservation,
  missionTitle,
  busy,
  onClose,
  onConfirm,
}: {
  reservation: InventoryReservation
  missionTitle?: string
  busy: boolean
  onClose: () => void
  onConfirm: (payload: {
    resolutionMode: CenterResolutionMode
    notes?: string
    meta?: {
      responsibleName?: string
      etaMinutes?: number
      driverName?: string
      driverPhone?: string
      vehicle?: string
    }
  }) => Promise<void>
}) {
  const [step, setStep] = useState<ResolutionStep>('choose')
  const [mode, setMode] = useState<CenterResolutionMode | null>(null)
  const [notes, setNotes] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [etaMinutes, setEtaMinutes] = useState('30')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const choose = (next: CenterResolutionMode) => {
    setMode(next)
    setStep('details')
    setError(null)
  }

  const submit = async () => {
    if (!mode) return
    setError(null)

    if (mode === 'brigade') {
      if (!responsibleName.trim()) {
        setError('Indica el nombre del responsable.')
        return
      }
    }
    if (mode === 'delivery') {
      if (!driverName.trim() || !driverPhone.trim()) {
        setError('Indica conductor y teléfono.')
        return
      }
    }

    try {
      await onConfirm({
        resolutionMode: mode,
        notes: notes.trim() || undefined,
        meta: {
          responsibleName: responsibleName.trim() || undefined,
          etaMinutes: Number(etaMinutes) || undefined,
          driverName: driverName.trim() || undefined,
          driverPhone: driverPhone.trim() || undefined,
          vehicle: vehicle.trim() || undefined,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la respuesta')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <GlassCard className="w-full max-w-md space-y-4 !p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Respuesta operativa
          </p>
          <h3 className="mt-1 text-sm font-semibold text-ink">
            {missionTitle ?? `Caso ${reservation.caseId.slice(0, 8)}`}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {reservation.quantity} × {getResourceLabel(reservation.resourceType)}
          </p>
        </div>

        {step === 'choose' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-muted">¿Cómo resolverá esta solicitud?</p>
            {(
              [
                ['brigade', 'Tenemos brigada propia'],
                ['delivery', 'Tenemos delivery propio'],
                ['needs_volunteer', 'Necesitamos voluntario'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => choose(value)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  'border-white/[0.08] text-ink hover:bg-white/[0.04]',
                )}
              >
                {label}
              </button>
            ))}
            <EmergencyButton variant="glass" size="sm" className="w-full" onClick={onClose}>
              Cancelar
            </EmergencyButton>
          </div>
        )}

        {step === 'details' && mode && (
          <div className="space-y-3">
            {mode === 'brigade' && (
              <>
                <Field
                  label="Nombre del responsable"
                  value={responsibleName}
                  onChange={setResponsibleName}
                  placeholder="Ej. María Pérez"
                />
                <Field
                  label="Tiempo estimado (min)"
                  value={etaMinutes}
                  onChange={setEtaMinutes}
                  type="number"
                />
              </>
            )}
            {mode === 'delivery' && (
              <>
                <Field label="Nombre del conductor" value={driverName} onChange={setDriverName} />
                <Field label="Teléfono" value={driverPhone} onChange={setDriverPhone} />
                <Field label="Vehículo" value={vehicle} onChange={setVehicle} placeholder="Moto / Camioneta" />
                <Field
                  label="Tiempo estimado (min)"
                  value={etaMinutes}
                  onChange={setEtaMinutes}
                  type="number"
                />
              </>
            )}
            {mode === 'needs_volunteer' && (
              <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                Se notificará automáticamente al Gestor de Casos para abrir el Radar. No continuarás
                esta misión con el centro solo.
              </p>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Observaciones (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder='Ej. "Favor llamar antes de llegar."'
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-ink"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-critical/10 px-3 py-2 text-xs text-critical">{error}</p>
            )}

            <div className="flex gap-2">
              <EmergencyButton
                variant="glass"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setStep('choose')
                  setMode(null)
                }}
              >
                Atrás
              </EmergencyButton>
              <EmergencyButton
                variant="primary"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? 'Guardando…' : 'Confirmar'}
              </EmergencyButton>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-ink"
      />
    </div>
  )
}
