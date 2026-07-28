import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import {
  Navigation,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  Camera,
  Timer,
  Radio,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { OperationalTimeline, type TimelineStep } from '@/components/dispatch/operational-timeline'
import { MapZoomControls, MapLocateControl, MapGoogleLinkButton } from '@/components/faro/map-controls'
import { useGeolocation, haversineDistance, formatDistance, estimateTravelTime } from '@/hooks/useGeolocation'
import { getResourceLabel } from '@/lib/resource-catalog'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { label, PRIORITY_LABELS } from '@/lib/labels'
import { useUpdateMissionAssignment, useSubmitEvidence, useReportEtaDelay } from '@/hooks/useMissionMutations'
import type { Mission, MissionAssignment } from '@/domain/mission.types'

interface ActiveMissionViewProps {
  mission: Mission
  assignment: MissionAssignment
  volunteerId: string
  /** Solo se usa cuando la misión ya finalizó (completed/verified) o fue rechazada. */
  onClose: () => void
}

const LOCKED_STATUSES = new Set([
  'assigned',
  'accepted',
  'preparing',
  'en_route',
  'on_site',
  'in_progress',
])

function createVolunteerMarker() {
  return divIcon({
    className: '',
    html: `<div class="relative flex h-8 w-8 items-center justify-center">
      <div class="absolute h-8 w-8 rounded-full bg-info/30 animate-ping" />
      <div class="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-info ring-2 ring-[#0A0F1A]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10"/></svg>
      </div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function createMissionMarker(priority: string) {
  const color = priority === 'critical' ? '#EF4444' : priority === 'high' ? '#F59E0B' : '#3B82F6'
  return divIcon({
    className: '',
    html: `<div class="relative flex h-8 w-8 items-center justify-center">
      <div class="absolute h-8 w-8 rounded-full" style="background:${color}30" />
      <div class="relative z-10 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-[#0A0F1A]" style="background:${color}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      </div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function MapAutoCenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap()
  useMemo(() => {
    map.setView(center, zoom ?? 14, { animate: true })
  }, [center[0], center[1]])
  return null
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function missionClockStart(assignment: MissionAssignment): Date | null {
  if (assignment.status === 'assigned') return null
  return (
    assignment.preparingAt ??
    assignment.respondedAt ??
    assignment.assignedAt ??
    null
  )
}

/** Al finalizar o validar, el cronómetro debe congelarse — no seguir contando. */
function missionClockEnd(assignment: MissionAssignment): Date | null {
  if (assignment.verifiedAt) return assignment.verifiedAt
  if (assignment.status === 'completed' && assignment.completedAt) return assignment.completedAt
  if (assignment.status === 'verified' && assignment.completedAt) return assignment.completedAt
  return null
}

const TERMINAL_ASSIGNMENT_STATUSES = new Set(['completed', 'verified', 'rejected', 'cancelled', 'archived'])

export function ActiveMissionView({ mission, assignment, volunteerId, onClose }: ActiveMissionViewProps) {
  const { position, error: geoError, requestPermission } = useGeolocation(volunteerId)
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(assignment.evidenceUrls ?? [])
  const [showEvidenceForm, setShowEvidenceForm] = useState(false)
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const updateStatus = useUpdateMissionAssignment()
  const submitEvidence = useSubmitEvidence()
  const reportEta = useReportEtaDelay()
  const [etaBumpMin, setEtaBumpMin] = useState(0)

  const locked = LOCKED_STATUSES.has(assignment.status)
  const isResourceMission = Boolean(mission.pickupCenterId)
  const missionCenter: [number, number] = [mission.location.lat, mission.location.lng]

  // Centro de recogida (mision logistica)
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!mission.pickupCenterId) return
    let cancelled = false
    ;(async () => {
      for (const table of ['hospitals', 'shelters', 'supply_centers'] as const) {
        const { data } = await supabase
          .from(table)
          .select('latitude, longitude')
          .eq('id', mission.pickupCenterId)
          .maybeSingle()
        if (!cancelled && data?.latitude != null && data?.longitude != null) {
          setPickupCoords({ lat: data.latitude as number, lng: data.longitude as number })
          return
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mission.pickupCenterId])

  const distance = position
    ? haversineDistance(position.lat, position.lng, mission.location.lat, mission.location.lng)
    : null
  const eta = distance ? estimateTravelTime(distance) : null
  const clockStart = missionClockStart(assignment)
  const clockEnd = missionClockEnd(assignment)
  const clockFrozen =
    TERMINAL_ASSIGNMENT_STATUSES.has(assignment.status) && Boolean(clockEnd ?? clockStart)
  const frozenEndMs = useMemo(() => {
    if (clockEnd) return clockEnd.getTime()
    if (TERMINAL_ASSIGNMENT_STATUSES.has(assignment.status)) return Date.now()
    return null
  }, [clockEnd?.getTime(), assignment.status])

  // Bloquear scroll del body mientras la experiencia está abierta.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Cronómetro: corre en vivo hasta completed/verified; luego congela el tiempo total.
  useEffect(() => {
    if (!clockStart) {
      setElapsedSec(0)
      return
    }

    const compute = () => {
      const endMs = frozenEndMs ?? Date.now()
      return Math.max(0, Math.floor((endMs - clockStart.getTime()) / 1000))
    }

    setElapsedSec(compute())
    if (frozenEndMs !== null) return

    const id = window.setInterval(() => setElapsedSec(compute()), 1000)
    return () => window.clearInterval(id)
  }, [clockStart?.getTime(), frozenEndMs, assignment.status])

  const timelineSteps: TimelineStep[] = isResourceMission
    ? [
        {
          id: 'assigned',
          label: 'Asignada',
          completed: assignment.status !== 'assigned',
          active: assignment.status === 'assigned',
          timestamp: assignment.assignedAt?.toISOString(),
        },
        {
          id: 'accepted',
          label: 'Aceptada',
          completed: !['assigned'].includes(assignment.status),
          active: assignment.status === 'accepted',
          timestamp: assignment.respondedAt?.toISOString(),
        },
        {
          id: 'preparing',
          label: 'Yendo al centro',
          completed: ['en_route', 'on_site', 'in_progress', 'completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'preparing',
          timestamp: assignment.preparingAt?.toISOString(),
        },
        {
          id: 'en_route',
          label: 'En camino al centro',
          completed: ['on_site', 'in_progress', 'completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'en_route',
        },
        {
          id: 'on_site',
          label: 'En el centro',
          completed: ['in_progress', 'completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'on_site',
        },
        {
          id: 'in_progress',
          label: 'En camino al destino',
          completed: ['completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'in_progress',
        },
        {
          id: 'completed',
          label: 'Entregado',
          completed: ['verified'].includes(assignment.status),
          active: assignment.status === 'completed',
        },
        {
          id: 'verified',
          label: 'Completada',
          completed: assignment.status === 'verified',
          active: assignment.status === 'verified',
        },
      ]
    : [
        {
          id: 'assigned',
          label: 'Asignada',
          completed: assignment.status !== 'assigned',
          active: assignment.status === 'assigned',
          timestamp: assignment.assignedAt?.toISOString(),
        },
        {
          id: 'accepted',
          label: 'Aceptada',
          completed: !['assigned'].includes(assignment.status),
          active: assignment.status === 'accepted',
          timestamp: assignment.respondedAt?.toISOString(),
        },
        {
          id: 'preparing',
          label: 'Preparándose',
          completed: ['en_route', 'on_site', 'in_progress', 'completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'preparing',
          timestamp: assignment.preparingAt?.toISOString(),
        },
        {
          id: 'en_route',
          label: 'En camino',
          completed: ['on_site', 'in_progress', 'completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'en_route',
          metadata: distance ? formatDistance(distance) : undefined,
        },
        {
          id: 'on_site',
          label: 'En sitio',
          completed: ['in_progress', 'completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'on_site',
        },
        {
          id: 'in_progress',
          label: 'Ejecutando',
          completed: ['completed', 'verified'].includes(assignment.status),
          active: assignment.status === 'in_progress',
        },
        {
          id: 'completed',
          label: 'Esperando validación',
          completed: ['verified'].includes(assignment.status),
          active: assignment.status === 'completed',
        },
        {
          id: 'verified',
          label: 'Completada',
          completed: assignment.status === 'verified',
          active: assignment.status === 'verified',
        },
      ]

  const handleAddEvidence = () => {
    if (!newEvidenceUrl.trim()) return
    setEvidenceUrls((prev) => [...prev, newEvidenceUrl.trim()])
    setNewEvidenceUrl('')
  }

  const handleSubmitEvidence = () => {
    submitEvidence.mutate({
      assignmentId: assignment.id,
      missionId: mission.id,
      volunteerId,
      evidenceUrls,
    })
  }

  const statusLabel = () => {
    if (isResourceMission) {
      switch (assignment.status) {
        case 'assigned':
          return 'Nueva misión logística — acéptala para ver el centro'
        case 'accepted':
          return 'Listo para ir al centro de acopio'
        case 'preparing':
          return 'Ve al centro a recoger los recursos'
        case 'en_route':
          return 'En camino al centro — avisa al llegar'
        case 'on_site':
          return 'En el centro — espera la entrega de recursos'
        case 'in_progress':
          return 'Recursos recogidos — ve al destino'
        case 'completed':
          return 'Entregado — esperando validación del gestor'
        case 'verified':
          return 'Misión completada y validada'
        default:
          return ''
      }
    }
    switch (assignment.status) {
      case 'assigned':
        return 'Nueva misión — acéptala para comenzar'
      case 'accepted':
        return 'Listo para iniciar el desplazamiento'
      case 'preparing':
        return 'Prepárate — el gestor ya te ve activo'
      case 'en_route':
        return 'En camino — avisa al llegar'
      case 'on_site':
        return 'En el sitio — inicia la ayuda'
      case 'in_progress':
        return 'Ayuda en curso — cronómetro activo'
      case 'completed':
        return 'Finalizaste — esperando validación del gestor'
      case 'verified':
        return 'Misión completada y validada'
      default:
        return ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#070B14]"
      role="dialog"
      aria-modal="true"
      aria-label="Experiencia de misión en vivo"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12),_transparent_55%)]" />

      {/* Top bar */}
      <header className="relative z-20 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        {locked ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-operational/15 text-operational">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-ink hover:bg-white/[0.12]"
            aria-label="Cerrar experiencia de misión"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{mission.title}</p>
          <p className="text-[11px] text-ink-muted">{statusLabel()}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
            mission.priority === 'critical'
              ? 'bg-critical/20 text-critical'
              : mission.priority === 'high'
                ? 'bg-warning/20 text-warning'
                : 'bg-info/20 text-info',
          )}
        >
          {label(PRIORITY_LABELS, mission.priority, mission.priority)}
        </span>
      </header>

      {/* Cronómetro + live badge */}
      <div className="relative z-20 mx-3 mb-2">
        <GlassCard className="flex items-center justify-between gap-3 border-info/20 bg-info/[0.06] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/20 text-info">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {clockFrozen ? 'Tiempo total' : clockStart ? 'Tiempo en misión' : 'Cronómetro'}
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {formatElapsed(elapsedSec)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {locked && !clockFrozen ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-operational/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-operational">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-operational" />
                En vivo
              </span>
            ) : clockFrozen ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Finalizada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Finalizada
              </span>
            )}
            {distance !== null && (
              <p className="mt-1 text-[11px] text-ink-muted">
                {formatDistance(distance)}
                {eta ? ` · ${eta}` : ''}
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Map */}
      <div className="relative z-10 mx-3 h-[28vh] min-h-[180px] overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
        <MapContainer
          className="faro-map h-full w-full"
          center={missionCenter}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom
          touchZoom
          doubleClickZoom
          dragging
          preferCanvas
        >
          <TileLayer className="faro-map-tiles" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapAutoCenter center={missionCenter} />
          <MapZoomControls />
          <MapLocateControl />
          <Marker position={missionCenter} icon={createMissionMarker(mission.priority)} />
          {pickupCoords && (
            <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={createMissionMarker('high')} />
          )}
          {position && <Marker position={[position.lat, position.lng]} icon={createVolunteerMarker()} />}
        </MapContainer>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#070B14] to-transparent" />
        {mission.location.lat && mission.location.lng && (
          <MapGoogleLinkButton lat={mission.location.lat} lng={mission.location.lng} label={mission.title} />
        )}
      </div>

      {geoError && assignment.status !== 'verified' && assignment.status !== 'archived' && (
        <div className="relative z-10 mx-3 mt-2">
          <GlassCard className="flex items-center gap-2 border-warning/20 bg-warning/[0.04] p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <p className="flex-1 text-xs text-ink-muted">{geoError}</p>
            <button
              type="button"
              onClick={requestPermission}
              className="rounded-lg bg-warning/15 px-2.5 py-1 text-[11px] font-medium text-warning hover:bg-warning/25"
            >
              Activar
            </button>
          </GlassCard>
        </div>
      )}

      <div className="faro-scroll relative z-10 mx-3 mt-3 flex-1 space-y-3 pb-2">
        <GlassCard className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Línea de tiempo en vivo</p>
            {locked && (
              <span className="text-[10px] text-ink-faint">El gestor ve estos avances</span>
            )}
          </div>
          <OperationalTimeline steps={timelineSteps} />
        </GlassCard>

        {isResourceMission && (
          <GlassCard className="space-y-2 border-info/20 bg-info/[0.05] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Recursos a recoger
            </p>
            <p className="text-sm font-medium text-ink">
              {mission.resourceQty ?? '—'} × {getResourceLabel(mission.resourceType ?? '')}
            </p>
            <p className="text-xs text-ink-muted">
              Centro: {mission.pickupAddress ?? mission.pickupCenterId?.slice(0, 8)}
            </p>
            <p className="text-xs text-ink-muted">
              Destino: {mission.deliveryAddress ?? mission.location.zone}
            </p>
            {assignment.status === 'on_site' && (
              <p className="rounded-lg bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                Espera a que el coordinador marque los recursos como entregados.
              </p>
            )}
          </GlassCard>
        )}

        <GlassCard className="space-y-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Información de la misión</p>
          <p className="text-xs leading-relaxed text-ink-muted">{mission.description}</p>
          {mission.location.zone && (
            <div className="flex items-start gap-2 text-xs text-ink-muted">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
              <span>{mission.location.zone}</span>
            </div>
          )}
          {mission.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mission.requiredSkills.map((s) => (
                <span key={s} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-faint">
                  {s}
                </span>
              ))}
            </div>
          )}
        </GlassCard>

        {assignment.status === 'completed' && (
          <GlassCard className="p-3">
            {!showEvidenceForm ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Evidencia</p>
                {evidenceUrls.length > 0 && (
                  <div className="space-y-1">
                    {evidenceUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                        <Camera className="h-3 w-3 text-ink-faint" />
                        <span className="flex-1 truncate text-[11px] text-ink-muted">{url}</span>
                        <button
                          type="button"
                          onClick={() => setEvidenceUrls((prev) => prev.filter((_, j) => j !== i))}
                          className="text-critical/70 hover:text-critical"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEvidenceForm(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-info/15 py-2.5 text-xs font-medium text-info hover:bg-info/25"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Agregar evidencia
                  </button>
                  {evidenceUrls.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSubmitEvidence}
                      disabled={submitEvidence.isPending}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-operational/15 py-2.5 text-xs font-medium text-operational hover:bg-operational/25 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {submitEvidence.isPending ? 'Enviando...' : 'Enviar evidencia'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Agregar URL de evidencia</p>
                <div className="flex gap-2">
                  <input
                    value={newEvidenceUrl}
                    onChange={(e) => setNewEvidenceUrl(e.target.value)}
                    placeholder="https://ejemplo.com/foto.jpg"
                    className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-info/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddEvidence}
                    disabled={!newEvidenceUrl.trim()}
                    className="rounded-xl bg-info/15 px-3 text-xs font-medium text-info hover:bg-info/25 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEvidenceForm(false)}
                  className="text-[11px] text-ink-faint hover:text-ink-muted"
                >
                  ← Volver
                </button>
              </div>
            )}
          </GlassCard>
        )}
      </div>

      {/* Bottom actions — tarjeta operacional simplificada */}
      <div className="relative z-20 shrink-0 border-t border-white/[0.06] bg-[#070B14]/95 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
        {locked && (
          <p className="mb-2 text-center text-[10px] text-ink-faint">
            Cada botón registra un evento de misión para el gestor
          </p>
        )}

        {(assignment.status === 'accepted' || assignment.status === 'preparing') && (
          <button
            type="button"
            onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'en_route' })}
            disabled={updateStatus.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-info py-4 text-base font-semibold text-white shadow-lg shadow-info/25 transition-all hover:bg-info/90 disabled:opacity-50"
          >
            <Navigation className="h-5 w-5" />
            {updateStatus.isPending
              ? 'Avisando...'
              : isResourceMission
                ? 'En camino al centro'
                : 'En camino'}
          </button>
        )}

        {assignment.status === 'en_route' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'on_site' })}
              disabled={updateStatus.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-warning py-4 text-base font-semibold text-white shadow-lg shadow-warning/25 transition-all hover:bg-warning/90 disabled:opacity-50"
            >
              <MapPin className="h-5 w-5" />
              {updateStatus.isPending
                ? 'Avisando...'
                : isResourceMission
                  ? 'Llegué al centro'
                  : 'Llegué'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  reportEta.mutate(
                    { assignmentId: assignment.id, minutes: 5, actorId: volunteerId },
                    { onSuccess: () => setEtaBumpMin((n) => n + 5) },
                  )
                }
                disabled={reportEta.isPending}
                className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-white/[0.12] py-3 text-sm font-semibold text-ink hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Clock className="h-4 w-4" />
                +5 min
              </button>
              <button
                type="button"
                onClick={() =>
                  reportEta.mutate(
                    { assignmentId: assignment.id, minutes: 10, actorId: volunteerId },
                    { onSuccess: () => setEtaBumpMin((n) => n + 10) },
                  )
                }
                disabled={reportEta.isPending}
                className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-white/[0.12] py-3 text-sm font-semibold text-ink hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Clock className="h-4 w-4" />
                +10 min
              </button>
              <button
                type="button"
                onClick={() =>
                  reportEta.mutate(
                    { assignmentId: assignment.id, minutes: 15, actorId: volunteerId },
                    { onSuccess: () => setEtaBumpMin((n) => n + 15) },
                  )
                }
                disabled={reportEta.isPending}
                className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-white/[0.12] py-3 text-sm font-semibold text-ink hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Clock className="h-4 w-4" />
                +15 min
              </button>
            </div>
            {etaBumpMin > 0 && (
              <p className="text-center text-[11px] text-ink-muted">
                Retraso reportado: +{etaBumpMin} min
              </p>
            )}
          </div>
        )}

        {isResourceMission && assignment.status === 'on_site' && (
          <button
            type="button"
            onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'in_progress' })}
            disabled={updateStatus.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-info py-4 text-base font-semibold text-white shadow-lg shadow-info/25 transition-all hover:bg-info/90 disabled:opacity-50"
          >
            <Navigation className="h-5 w-5" />
            {updateStatus.isPending ? 'Avisando...' : 'Salir hacia el destino'}
          </button>
        )}

        {((!isResourceMission && (assignment.status === 'on_site' || assignment.status === 'in_progress')) ||
          (isResourceMission && assignment.status === 'in_progress')) && (
          <button
            type="button"
            onClick={() => {
              updateStatus.mutate({ assignmentId: assignment.id, status: 'completed' })
            }}
            disabled={updateStatus.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-operational py-4 text-base font-semibold text-white shadow-lg shadow-operational/25 transition-all hover:bg-operational/90 disabled:opacity-50"
          >
            <CheckCircle2 className="h-5 w-5" />
            {updateStatus.isPending ? 'Registrando...' : 'Entregado'}
          </button>
        )}

        {assignment.status === 'completed' && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-warning/10 py-3 text-sm font-semibold text-warning">
              <Clock className="h-5 w-5" />
              Esperando validación del gestor
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] py-3 text-sm font-medium text-ink-muted hover:bg-white/[0.04]"
            >
              Salir
            </button>
          </div>
        )}

        {assignment.status === 'verified' && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-operational/10 py-3 text-sm font-semibold text-operational">
              <CheckCircle2 className="h-5 w-5" />
              Misión completada
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] py-3 text-sm font-medium text-ink-muted hover:bg-white/[0.04]"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
