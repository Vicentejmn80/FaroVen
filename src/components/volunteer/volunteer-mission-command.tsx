import { useMemo, useState } from 'react'
import { Building2, MapPin, Navigation } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { CoverageQuickPickModal } from '@/components/shared/coverage-quick-pick-modal'
import { PickupCenterContactBlock } from '@/components/volunteer/pickup-center-contact-block'
import { useQuery } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { buildFaroRecommendations } from '@/services/faro-recommendation-engine'
import { useReserveInventoryByVolunteer } from '@/hooks/useLogistics'
import { useCase } from '@/hooks/useCases'
import { useUpdateMissionAssignment } from '@/hooks/useMissionMutations'
import type { Mission } from '@/domain/mission.types'
import type { MissionAssignment } from '@/domain/mission.types'
import { getResourceLabel } from '@/lib/resource-catalog'
import { cn } from '@/lib/utils'
import { resolveCaseResource } from '@/domain/case-resource'

const TIMELINE_ACTIONS: Array<{
  status: string
  label: string
  next: string
}> = [
  { status: 'accepted', label: 'En camino', next: 'en_route' },
  { status: 'preparing', label: 'En camino', next: 'en_route' },
  { status: 'en_route', label: 'Llegué al centro', next: 'on_site' },
  { status: 'on_site', label: 'Recursos retirados', next: 'in_progress' },
  { status: 'in_progress', label: 'En camino al destino', next: 'in_progress' },
]

/**
 * Pantalla mínima de misión: título, ubicación, tiempo, centros FARO, Reservar/Navegar.
 * Contacto solo tras aceptación del centro. Timeline = solo botones.
 */
export function VolunteerMissionCommand({
  mission,
  assignment,
  volunteerId,
  volunteerName,
  onClose,
}: {
  mission: Mission
  assignment: MissionAssignment
  volunteerId?: string
  volunteerName?: string
  onClose?: () => void
}) {
  const { data: caseData } = useCase(mission.caseId ?? null)
  const reserve = useReserveInventoryByVolunteer()
  const updateStatus = useUpdateMissionAssignment()
  const [pickCenterId, setPickCenterId] = useState<string | null>(null)

  const { data: reco } = useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'mission-centers', mission.id],
    queryFn: () => {
      if (!caseData) throw new Error('Caso no disponible')
      return buildFaroRecommendations(caseData)
    },
    enabled: Boolean(caseData?.id),
    staleTime: 20_000,
  })

  const { data: caseReservations = [] } = useQuery({
    queryKey: [FARO_QUERY_KEYS.inventoryReservations, 'case', mission.caseId],
    queryFn: async () => {
      const { listReservationsByCase } = await import('@/services/logistics-service')
      return listReservationsByCase(mission.caseId!)
    },
    enabled: Boolean(mission.caseId),
    staleTime: 6_000,
  })

  const activeReservation = useMemo(() => {
    return (
      caseReservations.find(
        (r) =>
          r.missionId === mission.id &&
          (r.volunteerId === volunteerId || r.volunteerUserId) &&
          (r.status === 'reserved' || r.status === 'ready'),
      ) ??
      caseReservations.find((r) => r.missionId === mission.id && (r.status === 'reserved' || r.status === 'ready'))
    )
  }, [caseReservations, mission.id, volunteerId])

  const contactUnlocked = Boolean(activeReservation?.acceptedAt || activeReservation?.status === 'ready')
  const expiresMs = activeReservation?.expiresAt?.getTime()
  const remainingMin =
    expiresMs != null ? Math.max(0, Math.ceil((expiresMs - Date.now()) / 60000)) : null

  const centers = reco?.centers ?? []
  const caseResource = caseData ? resolveCaseResource(caseData) : null
  const resourceType =
    mission.resourceType ?? caseResource?.resourceType ?? 'recurso'
  const remainingQty = Math.max(
    1,
    mission.resourceQty ?? caseResource?.requiredQty ?? caseData?.affectedCount ?? 1,
  )

  const mapsUrl =
    mission.location.lat != null && mission.location.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${mission.location.lat},${mission.location.lng}`
      : null

  const primaryAction = TIMELINE_ACTIONS.find((a) => a.status === assignment.status)
  // Special: on_site after resources → in_progress already; add "Entregado" at in_progress second press via completed
  const showDelivered = assignment.status === 'in_progress'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">Misión</p>
          <h2 className="text-lg font-semibold text-ink">{mission.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin className="h-3 w-3" />
            {mission.deliveryAddress ?? mission.location.zone ?? 'Destino'}
          </p>
        </div>
        {remainingMin != null && (
          <span className="rounded-lg bg-warning/15 px-2 py-1 text-[11px] font-semibold text-warning">
            {remainingMin}m
          </span>
        )}
      </div>

      {!activeReservation && centers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-operational">
            Recomendado por FARO
          </p>
          {centers.slice(0, 4).map((c) => (
            <GlassCard key={c.centerId} className="!p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{c.centerName}</p>
                  <p className="text-[11px] text-ink-muted">
                    {c.distanceKm.toFixed(1)} km · {c.available} {c.unit} · score {c.score}
                  </p>
                </div>
                <span className="text-[10px] text-ink-faint">{c.dispatchModeLabel}</span>
              </div>
              <div className="flex gap-2">
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  disabled={reserve.isPending}
                  onClick={() => setPickCenterId(c.centerId)}
                >
                  Reservar
                </EmergencyButton>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.centerName)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 px-2 text-xs font-medium text-info"
                >
                  <Navigation className="h-3 w-3" />
                  Navegar
                </a>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {activeReservation?.status === 'reserved' && !contactUnlocked && (
        <GlassCard className="!border-warning/30 !bg-warning/[0.06] !p-3">
          <p className="text-sm font-medium text-warning">Esperando confirmación del centro</p>
          <p className="text-xs text-ink-muted">
            Reservaste {activeReservation.quantity} × {getResourceLabel(activeReservation.resourceType)}.
            {remainingMin != null ? ` Expira en ${remainingMin} min.` : ''}
          </p>
        </GlassCard>
      )}

      {contactUnlocked && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-operational">Centro confirmó tu retiro. Puedes dirigirte al centro.</p>
          <PickupCenterContactBlock
            centerId={activeReservation?.centerId ?? mission.pickupCenterId}
            fallbackAddress={mission.pickupAddress}
          />
        </div>
      )}

      <div className="space-y-2">
        {primaryAction && assignment.status !== 'in_progress' && (
          <EmergencyButton
            variant="primary"
            size="sm"
            className="w-full"
            disabled={updateStatus.isPending || (primaryAction.next !== 'en_route' && !contactUnlocked && Boolean(mission.pickupCenterId || activeReservation))}
            onClick={() =>
              updateStatus.mutate({
                assignmentId: assignment.id,
                status: primaryAction.next as 'preparing' | 'en_route' | 'on_site' | 'in_progress' | 'completed',
              })
            }
          >
            {primaryAction.label}
          </EmergencyButton>
        )}

        {showDelivered && (
          <>
            <EmergencyButton
              variant="glass"
              size="sm"
              className="w-full"
              disabled={updateStatus.isPending}
              onClick={() => {
                if (mapsUrl) window.open(mapsUrl, '_blank')
              }}
            >
              En camino al destino
            </EmergencyButton>
            <EmergencyButton
              variant="primary"
              size="sm"
              className="w-full"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({
                  assignmentId: assignment.id,
                  status: 'completed',
                })
              }
            >
              Entregado
            </EmergencyButton>
          </>
        )}

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-xs font-medium text-info',
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            Navegar al destino
          </a>
        )}

        {onClose && (
          <EmergencyButton variant="glass" size="sm" className="w-full" onClick={onClose}>
            Cerrar
          </EmergencyButton>
        )}
      </div>

      <CoverageQuickPickModal
        open={Boolean(pickCenterId)}
        title="¿Cuánto puedes retirar?"
        remaining={remainingQty}
        unit={getResourceLabel(resourceType)}
        loading={reserve.isPending}
        onClose={() => setPickCenterId(null)}
        onPick={(qty) => {
          if (!pickCenterId || !mission.caseId) return
          reserve.mutate(
            {
              missionId: mission.id,
              caseId: mission.caseId,
              centerId: pickCenterId,
              resourceType,
              quantity: qty,
              volunteerId,
              volunteerName,
              etaMinutes: 15,
            },
            { onSuccess: () => setPickCenterId(null) },
          )
        }}
      />
    </div>
  )
}

