import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import {
  Navigation,
  MapPin,
  Clock,
  AlertTriangle,
  Shield,
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
import { cn } from '@/lib/utils'
import { label, PRIORITY_LABELS } from '@/lib/labels'
import { useRespondMission, useUpdateMissionAssignment, useSubmitEvidence } from '@/hooks/useMissionMutations'
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

export function ActiveMissionView({ mission, assignment, volunteerId, onClose }: ActiveMissionViewProps) {
  const { position, error: geoError, requestPermission } = useGeolocation(volunteerId)
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(assignment.evidenceUrls ?? [])
  const [showEvidenceForm, setShowEvidenceForm] = useState(false)
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const respondMission = useRespondMission()
  const updateStatus = useUpdateMissionAssignment()
  const submitEvidence = useSubmitEvidence()

  const locked = LOCKED_STATUSES.has(assignment.status)
  const missionCenter: [number, number] = [mission.location.lat, mission.location.lng]
  const distance = position
    ? haversineDistance(position.lat, position.lng, mission.location.lat, mission.location.lng)
    : null
  const eta = distance ? estimateTravelTime(distance) : null
  const clockStart = missionClockStart(assignment)

  // Bloquear scroll del body mientras la experiencia está abierta.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Cronómetro en vivo desde aceptar / iniciar.
  useEffect(() => {
    if (!clockStart) {
      setElapsedSec(0)
      return
    }
    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - clockStart.getTime()) / 1000))
      setElapsedSec(secs)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [clockStart?.getTime(), assignment.status])

  const timelineSteps: TimelineStep[] = [
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
                {clockStart ? 'Tiempo en misión' : 'Cronómetro'}
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {formatElapsed(elapsedSec)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {locked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-operational/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-operational">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-operational" />
                En vivo
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

      {/* Bottom actions — avisos al gestor */}
      <div className="relative z-20 shrink-0 border-t border-white/[0.06] bg-[#070B14]/95 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
        {locked && (
          <p className="mb-2 text-center text-[10px] text-ink-faint">
            Cada botón notifica al gestor de casos en tiempo real
          </p>
        )}

        {assignment.status === 'assigned' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                respondMission.mutate({ assignmentId: assignment.id, action: 'reject', volunteerId })
              }
              disabled={respondMission.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-critical/30 py-3.5 text-sm font-semibold text-critical transition-all hover:bg-critical/10 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
              No puedo
            </button>
            <button
              type="button"
              onClick={() =>
                respondMission.mutate({ assignmentId: assignment.id, action: 'accept', volunteerId })
              }
              disabled={respondMission.isPending}
              className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-operational py-3.5 text-sm font-semibold text-white shadow-lg shadow-operational/25 transition-all hover:bg-operational/90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" />
              {respondMission.isPending ? 'Aceptando...' : 'Comenzar misión'}
            </button>
          </div>
        )}

        {assignment.status === 'accepted' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'preparing' })}
              disabled={updateStatus.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[0.15] py-3.5 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06] disabled:opacity-50"
            >
              Estoy listo
            </button>
            <button
              type="button"
              onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'en_route' })}
              disabled={updateStatus.isPending}
              className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-info py-3.5 text-sm font-semibold text-white shadow-lg shadow-info/25 transition-all hover:bg-info/90 disabled:opacity-50"
            >
              <Navigation className="h-5 w-5" />
              {updateStatus.isPending ? 'Avisando...' : 'Voy en camino'}
            </button>
          </div>
        )}

        {assignment.status === 'preparing' && (
          <button
            type="button"
            onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'en_route' })}
            disabled={updateStatus.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-info py-3.5 text-sm font-semibold text-white shadow-lg shadow-info/25 transition-all hover:bg-info/90 disabled:opacity-50"
          >
            <Navigation className="h-5 w-5" />
            {updateStatus.isPending ? 'Avisando...' : 'Salgo ahora / Voy en camino'}
          </button>
        )}

        {assignment.status === 'en_route' && (
          <button
            type="button"
            onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'on_site' })}
            disabled={updateStatus.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-warning py-3.5 text-sm font-semibold text-white shadow-lg shadow-warning/25 transition-all hover:bg-warning/90 disabled:opacity-50"
          >
            <MapPin className="h-5 w-5" />
            {updateStatus.isPending ? 'Avisando...' : 'Ya llegué al sitio'}
          </button>
        )}

        {assignment.status === 'on_site' && (
          <button
            type="button"
            onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'in_progress' })}
            disabled={updateStatus.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Shield className="h-5 w-5" />
            {updateStatus.isPending ? 'Iniciando...' : 'Iniciar ayuda'}
          </button>
        )}

        {assignment.status === 'in_progress' && (
          <button
            type="button"
            onClick={() => updateStatus.mutate({ assignmentId: assignment.id, status: 'completed' })}
            disabled={updateStatus.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-operational py-3.5 text-sm font-semibold text-white shadow-lg shadow-operational/25 transition-all hover:bg-operational/90 disabled:opacity-50"
          >
            <CheckCircle2 className="h-5 w-5" />
            {updateStatus.isPending ? 'Finalizando...' : 'Ya finalicé la misión'}
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
              Salir de la experiencia
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
