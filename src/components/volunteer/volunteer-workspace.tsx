import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useVolunteerProfile, useVolunteerMissions, useUpdateVolunteerAvailability } from '@/hooks/useVolunteerProfile'
import { useMissions } from '@/hooks/useMissions'
import { useUpdateMissionAssignment, useRespondMission, useSubmitEvidence } from '@/hooks/useMissionMutations'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { VolunteerMissionCard } from './volunteer-mission-card'
import { ActiveMissionView } from './active-mission-view'
import { GlassCard } from '@/components/ui/glass-card'
import { LiveTrackingCard } from '@/components/dispatch/live-tracking-card'
import { OperationalTimeline, type TimelineStep } from '@/components/dispatch/operational-timeline'
import { VOLUNTEER_AVAILABILITY, VOLUNTEER_AVAILABILITY_LABELS, VOLUNTEER_AVAILABILITY_TONES, VERIFICATION_LEVEL_LABELS, SKILL_LABELS } from '@/domain/volunteer.types'
import type { Mission } from '@/domain/mission.types'
import { getResourceLabel } from '@/lib/resource-catalog'
import { useAuth, usePermissions } from '@/store/auth-context'
import { cn } from '@/lib/utils'
import { animate } from 'framer-motion'
import { Flag } from 'lucide-react'
import { ASSIGNMENT_STATUS_LABELS, label, PRIORITY_LABELS, PUBLIC_NEED_STATUS_LABELS } from '@/lib/labels'
import { useCreateCoverageReservation, usePublicNeeds } from '@/hooks/usePublicNeeds'
import { SuccessCasesPanel } from '@/components/shared/success-cases-panel'
import { PickupCenterContactBlock } from '@/components/volunteer/pickup-center-contact-block'
import {
  dismissMissionForUser,
  loadDismissedMissionIds,
} from '@/lib/mission-dismiss-storage'

type VolunteerTab = 'available' | 'my-missions' | 'history' | 'profile'

function AvailabilitySelector({
  current,
  volunteerId,
}: {
  current: string
  volunteerId: string
}) {
  const update = useUpdateVolunteerAvailability()
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.values(VOLUNTEER_AVAILABILITY).map((status) => (
        <button
          key={status}
          onClick={() => update.mutate({ volunteerId, status })}
          disabled={update.isPending}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-all',
            current === status
              ? VOLUNTEER_AVAILABILITY_TONES[status]
              : 'border border-white/10 text-ink-faint hover:bg-white/[0.04]',
          )}
        >
          {VOLUNTEER_AVAILABILITY_LABELS[status]}
        </button>
      ))}
    </div>
  )
}

function AnimatedMetric({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return controls.stop
  }, [value])

  return <p className="text-lg font-semibold tabular-nums text-ink">{display}{suffix}</p>
}

function AvailableMissions() {
  const { data: publicNeeds, isLoading, error } = usePublicNeeds()
  const { isVolunteer } = usePermissions()
  const { data: profile } = useVolunteerProfile()
  const reserveCoverage = useCreateCoverageReservation()
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const needs = useMemo(
    () =>
      publicNeeds?.filter(
        (need) =>
          need.visibilityStatus === 'public' &&
          need.callStatus === 'open' &&
          ['active', 'in_progress', 'reserved'].includes(need.status) &&
          need.remainingQuantity > 0 &&
          (need.verificationStatus === 'approved_entry' ||
            need.verificationStatus === 'pending_exit' ||
            need.verificationStatus === 'approved_exit'),
      ) ?? [],
    [publicNeeds],
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <GlassCard key={i} className="h-24 animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-critical">Error: {(error as Error).message}</div>
  }

  if (!needs || needs.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-2 p-6 text-center">
        <Flag className="h-8 w-8 text-ink-faint" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No hay necesidades públicas disponibles</p>
        <p className="text-xs text-ink-subtle">
          Cuando el gestor publique nuevas necesidades, aparecerán aquí para postularte.
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {needs.map((need) => {
        const alreadyApplied = appliedIds.has(need.id)
        const canApply = isVolunteer && !!profile && !alreadyApplied && need.remainingQuantity > 0
        const hoursLeft = Math.max(0, Math.round((need.expiresAt.getTime() - Date.now()) / 3600000))
        const qty = quantities[need.id] ?? 1
        const showQtyPicker = need.requiredQuantity > 1

        return (
          <GlassCard key={need.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{need.title}</p>
                <p className="mt-1 text-xs text-ink-subtle line-clamp-2">{need.summary}</p>
              </div>
              <span className="rounded-full bg-info/20 px-2 py-0.5 text-[10px] font-semibold text-info">
                {label(PRIORITY_LABELS, need.priority, need.priority)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-muted">
              <span>{need.locationPublic.zone ?? 'Zona por confirmar'}</span>
              <span>{need.remainingQuantity} {need.unit} por cubrir</span>
              <span>{hoursLeft > 0 ? `${hoursLeft}h restantes` : 'Vencida'}</span>
              <span>{label(PUBLIC_NEED_STATUS_LABELS, need.status, need.status)}</span>
            </div>
            {showQtyPicker && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-ink-faint">Cantidad a cubrir</label>
                <input
                  type="number"
                  min={1}
                  max={need.remainingQuantity}
                  value={qty}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [need.id]: Math.min(
                        need.remainingQuantity,
                        Math.max(1, Number(e.target.value) || 1),
                      ),
                    }))
                  }
                  className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-ink"
                />
              </div>
            )}
            <div className="mt-3">
              <button
                type="button"
                className={cn(
                  'w-full rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                  canApply
                    ? 'bg-info text-white hover:bg-info/90'
                    : 'cursor-not-allowed border border-white/10 text-ink-faint',
                )}
                disabled={!canApply || reserveCoverage.isPending}
                onClick={() => {
                  if (!profile) return
                  reserveCoverage.mutate(
                    {
                      publicNeedId: need.id,
                      collaboratorType: 'volunteer',
                      collaboratorName: profile.fullName,
                      quantity: showQtyPicker ? qty : 1,
                    },
                    {
                      onSuccess: () => {
                        setAppliedIds((prev) => new Set(prev).add(need.id))
                      },
                    },
                  )
                }}
              >
                {alreadyApplied ? 'Postulación enviada' : reserveCoverage.isPending ? 'Enviando...' : 'Quiero ayudar'}
              </button>
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}

function VolunteerHistory() {
  return (
    <div className="space-y-6">
      <SuccessCasesPanel />
    </div>
  )
}

/** Estados inmersivos tras iniciar misión (assigned muestra modal de selección). */
const IMMERSIVE_MISSION_STATUSES = [
  'accepted',
  'preparing',
  'en_route',
  'on_site',
  'in_progress',
] as const

function SelectedMissionModal({
  missionTitle,
  mission,
  onStart,
  onReject,
  isPending,
}: {
  missionTitle: string
  mission?: Mission | null
  onStart: () => void
  onReject: () => void
  isPending: boolean
}) {
  const isResourceMission = Boolean(mission?.pickupCenterId)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <GlassCard className="w-full max-w-sm space-y-4 border-info/20 p-5">
        <div className="space-y-1 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-operational">
            Misión asignada
          </p>
          <h2 className="text-lg font-semibold text-ink">Misión asignada</h2>
          <p className="text-sm text-ink-muted">
            {isResourceMission
              ? 'Debes recoger recursos en un centro antes de ir al destino.'
              : 'Tu ayuda fue aceptada. Prepárate para iniciar la misión.'}
          </p>
          <p className="pt-1 text-xs text-ink-faint">{missionTitle}</p>
        </div>

        {isResourceMission && mission && (
          <div className="space-y-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                Recursos a recoger
              </p>
              <p className="text-sm font-medium text-ink">
                {mission.resourceQty ?? '—'} × {getResourceLabel(mission.resourceType ?? '')}
              </p>
              <p className="text-xs text-ink-muted">
                Destino: {mission.deliveryAddress ?? mission.location.zone}
              </p>
            </div>
            <PickupCenterContactBlock centerId={mission.pickupCenterId} fallbackAddress={mission.pickupAddress} />
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-operational py-3.5 text-sm font-semibold text-white hover:bg-operational/90 disabled:opacity-50"
        >
          {isPending ? 'Iniciando...' : isResourceMission ? 'Ir al centro' : 'Iniciar misión'}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isPending}
          className="w-full rounded-2xl border border-white/[0.1] py-2.5 text-xs font-medium text-ink-muted hover:bg-white/[0.04] disabled:opacity-50"
        >
          No disponible
        </button>
      </GlassCard>
    </div>
  )
}

function MyMissions() {
  const { user } = useAuth()
  const { data: profile } = useVolunteerProfile()
  const { data: assignments, isLoading } = useVolunteerMissions(profile?.id ?? '')
  const { data: allMissions } = useMissions()
  const updateStatus = useUpdateMissionAssignment()
  const respondMission = useRespondMission()
  const submitEvidence = useSubmitEvidence()
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null)

  const missionMap = useMemo(() => {
    const map = new Map<string, Mission>()
    if (allMissions) {
      for (const m of allMissions) {
        map.set(m.id, m)
      }
    }
    return map
  }, [allMissions])

  const activeStatuses: string[] = [
    'assigned',
    'accepted',
    'preparing',
    'en_route',
    'on_site',
    'in_progress',
  ]
  const activeAssignments = useMemo(
    () => (assignments ?? []).filter((a) => activeStatuses.includes(a.status)),
    [assignments],
  )
  const pastAssignments = useMemo(
    () => (assignments ?? []).filter((a) => !activeStatuses.includes(a.status)),
    [assignments],
  )

  const openImmersive = (assignmentId: string) => {
    window.dispatchEvent(
      new CustomEvent('faro:open-immersive-mission', { detail: { assignmentId } }),
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <GlassCard key={i} className="h-24 animate-pulse" />)}
      </div>
    )
  }

  if (!assignments || assignments.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-ink-subtle">No tienes misiones asignadas</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      {activeAssignments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Misiones activas ({activeAssignments.length})</h3>
          {activeAssignments.map((a) => {
            const m = missionMap.get(a.missionId)
            const realMission = m ?? {
              id: a.missionId,
              title: 'Misión',
              description: '',
              priority: 'medium' as const,
              requiredSkills: [],
              requiredPeople: 1,
              assignedPeople: 1,
              status: a.status as Mission['status'],
              centerId: '',
              location: { lat: 0, lng: 0, zone: '' },
              createdBy: '',
              createdAt: a.assignedAt,
              updatedAt: a.assignedAt,
            }
            const isExpanded = expandedMissionId === a.id
            const timelineSteps: TimelineStep[] = [
              { id: 'assigned', label: 'Asignada', completed: true, active: false },
              { id: 'accepted', label: 'Aceptada', completed: a.status !== 'assigned', active: a.status === 'accepted' },
              { id: 'preparing', label: 'Preparándose', completed: ['preparing', 'en_route', 'on_site', 'in_progress', 'completed', 'verified'].includes(a.status), active: a.status === 'preparing' },
              { id: 'en_route', label: 'En camino', completed: ['en_route', 'on_site', 'in_progress', 'completed', 'verified'].includes(a.status), active: a.status === 'en_route' },
              { id: 'on_site', label: 'En sitio', completed: ['on_site', 'in_progress', 'completed', 'verified'].includes(a.status), active: a.status === 'on_site' },
              { id: 'in_progress', label: 'Ejecutando', completed: ['in_progress', 'completed', 'verified'].includes(a.status), active: a.status === 'in_progress' },
              { id: 'completed', label: 'Esperando verificación', completed: ['completed', 'verified'].includes(a.status), active: a.status === 'completed' },
              { id: 'verified', label: 'Completada', completed: a.status === 'verified', active: a.status === 'verified' },
            ]
            const isImmersive = (IMMERSIVE_MISSION_STATUSES as readonly string[]).includes(a.status)
            const needsSelection = a.status === 'assigned'
            return (
              <div key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (isImmersive || needsSelection || a.status === 'completed') {
                      openImmersive(a.id)
                      return
                    }
                    setExpandedMissionId(isExpanded ? null : a.id)
                  }}
                  className="w-full text-left"
                >
                  <VolunteerMissionCard
                    mission={realMission}
                    assignment={a}
                    onUpdateStatus={(status) => {
                      openImmersive(a.id)
                      updateStatus.mutate({ assignmentId: a.id, status })
                    }}
                    onAccept={() => {
                      if (!user?.id) return
                      openImmersive(a.id)
                      respondMission.mutate({ assignmentId: a.id, action: 'accept', volunteerId: user.id })
                    }}
                    onReject={() => {
                      if (!user?.id) return
                      respondMission.mutate({ assignmentId: a.id, action: 'reject', volunteerId: user.id })
                    }}
                    onEvidenceSubmit={(evidenceUrls) => {
                      submitEvidence.mutate({
                        assignmentId: a.id,
                        missionId: a.missionId,
                        volunteerId: user?.id ?? '',
                        evidenceUrls,
                      })
                    }}
                  />
                </button>
                {isExpanded && !isImmersive && (
                  <div className="space-y-3 px-1 pt-2 pb-4">
                    <LiveTrackingCard
                      missionLat={realMission.location.lat}
                      missionLng={realMission.location.lng}
                      missionAddress={
                        realMission.location.zone ??
                        `${realMission.location.lat.toFixed(4)}, ${realMission.location.lng.toFixed(4)}`
                      }
                      volunteerUserId={user?.id}
                    />
                    <div className="rounded-2xl bg-white/[0.03] p-3">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Progreso</p>
                      <OperationalTimeline steps={timelineSteps} />
                    </div>
                    <button
                      type="button"
                      onClick={() => openImmersive(a.id)}
                      className="w-full rounded-2xl bg-info/15 py-3 text-sm font-semibold text-info transition-all hover:bg-info/25"
                    >
                      Abrir experiencia de misión
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {pastAssignments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-ink-subtle">Historial ({pastAssignments.length})</h3>
          {pastAssignments.map((a) => {
            const m = missionMap.get(a.missionId)
            return (
              <GlassCard key={a.id} className="p-3 opacity-70">
                <div className="flex justify-between text-xs">
                  <span className="text-ink">{m?.title ?? `Misión ${a.missionId.slice(0, 8)}`}</span>
                  <span className="text-ink-subtle">
                    {label(ASSIGNMENT_STATUS_LABELS, a.status, a.status)}
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

function ProfileSection() {
  const { data: profile, isLoading } = useVolunteerProfile()

  if (isLoading || !profile) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-ink-subtle">Cargando perfil...</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">{profile.fullName}</h3>
            <p className="text-xs text-ink-subtle">{profile.zone}</p>
          </div>
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', VOLUNTEER_AVAILABILITY_TONES[profile.availability])}>
            {VOLUNTEER_AVAILABILITY_LABELS[profile.availability]}
          </span>
        </div>

        <p className="text-xs text-ink-subtle mb-2">Cambiar disponibilidad</p>
        <AvailabilitySelector current={profile.availability} volunteerId={profile.id} />
      </GlassCard>

      <GlassCard className="p-4">
        <h4 className="text-xs font-semibold text-ink mb-3">Métricas operativas</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <AnimatedMetric value={profile.trustScore} suffix="%" />
            <p className="text-[10px] text-ink-faint">Confianza</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <AnimatedMetric value={profile.totalMissions} />
            <p className="text-[10px] text-ink-faint">Misiones ({profile.completedMissions} ok)</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <AnimatedMetric value={profile.serviceHours} suffix="h" />
            <p className="text-[10px] text-ink-faint">Horas servicio</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-lg font-semibold text-ink">{profile.avgResponseMinutes}min</p>
            <p className="text-[10px] text-ink-faint">Respuesta</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-lg font-semibold text-ink">{profile.avgMissionDurationMinutes}min</p>
            <p className="text-[10px] text-ink-faint">Duración media</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-lg font-semibold text-ink">{VERIFICATION_LEVEL_LABELS[profile.verificationLevel]?.split(' ')[0] ?? 'N/A'}</p>
            <p className="text-[10px] text-ink-faint">Verificación</p>
          </div>
        </div>
      </GlassCard>

      {profile.specialties.length > 0 && (
        <GlassCard className="p-4">
          <h4 className="text-xs font-semibold text-ink mb-2">Especialidades</h4>
          <div className="flex flex-wrap gap-1.5">
            {profile.specialties.map((s) => (
              <span key={s} className="inline-flex items-center rounded-full bg-operational/20 text-operational px-2.5 py-1 text-xs font-medium">
                {SKILL_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {profile.centersCollaborated.length > 0 && (
        <GlassCard className="p-4">
          <h4 className="text-xs font-semibold text-ink mb-2">Centros donde ha colaborado</h4>
          <div className="flex flex-wrap gap-1.5">
            {profile.centersCollaborated.map((c) => (
              <span key={c} className="inline-flex items-center rounded-full bg-white/10 text-ink-subtle px-2.5 py-1 text-xs">
                {c}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {profile.skills.length > 0 && (
        <GlassCard className="p-4">
          <h4 className="text-xs font-semibold text-ink mb-2">Habilidades</h4>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span key={skill} className="inline-flex items-center rounded-full bg-info/20 text-info px-2.5 py-1 text-xs font-medium">
                {SKILL_LABELS[skill] ?? skill}
              </span>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}

const TABS: Array<{ id: VolunteerTab; label: string }> = [
  { id: 'available', label: 'Centro' },
  { id: 'my-missions', label: 'Activas' },
  { id: 'history', label: 'Historial' },
  { id: 'profile', label: 'Perfil' },
]

const ACTIVE_ASSIGNMENT_STATUSES = [
  'assigned',
  'accepted',
  'preparing',
  'en_route',
  'on_site',
  'in_progress',
] as const

function MissionCenterHome({ onExplore }: { onExplore: () => void }) {
  const { data: profile } = useVolunteerProfile()
  const { data: assignments = [] } = useVolunteerMissions(profile?.id ?? '')
  const { data: allMissions } = useMissions()

  const active = useMemo(
    () => assignments.filter((a) => (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(a.status)),
    [assignments],
  )
  const pastCount = useMemo(
    () => assignments.filter((a) => !(ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(a.status)).length,
    [assignments],
  )
  const current = active[0]
  const currentMission = useMemo(() => {
    if (!current || !allMissions) return null
    return allMissions.find((m) => m.id === current.missionId) ?? null
  }, [current, allMissions])

  const statusLabel = current
    ? label(ASSIGNMENT_STATUS_LABELS, current.status, current.status)
    : null

  return (
    <div className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <GlassCard className="!p-3">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Misiones activas</p>
          <AnimatedMetric value={active.length} />
        </GlassCard>
        <GlassCard className="!p-3">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Historial</p>
          <AnimatedMetric value={pastCount} />
        </GlassCard>
        <GlassCard className="!p-3">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Horas</p>
          <AnimatedMetric value={profile?.serviceHours ?? 0} suffix="h" />
        </GlassCard>
        <GlassCard className="!p-3">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Impacto</p>
          <AnimatedMetric value={profile?.completedMissions ?? 0} />
        </GlassCard>
        <GlassCard className="!p-3">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Participación</p>
          <AnimatedMetric value={profile?.trustScore ?? 0} suffix="%" />
        </GlassCard>
        <GlassCard className="!p-3">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Resp. promedio</p>
          <p className="text-lg font-semibold tabular-nums text-ink">
            {profile?.avgResponseMinutes != null ? `${profile.avgResponseMinutes}m` : '—'}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="!border-info/20 !bg-info/[0.05] !p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Mi misión actual
        </p>
        {current && currentMission ? (
          <>
            <p className="text-base font-semibold text-ink">{currentMission.title}</p>
            <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
              <span>
                Estado · <span className="font-medium text-operational">{statusLabel}</span>
              </span>
              {currentMission.eta && (
                <span>
                  Llegada estimada ·{' '}
                  {currentMission.eta.toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('faro:open-immersive-mission', {
                    detail: { assignmentId: current.id },
                  }),
                )
              }
              className="w-full rounded-2xl bg-info py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(10,132,255,0.35)]"
            >
              Continuar misión
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">No tienes misiones activas</p>
            <p className="text-xs text-ink-muted">
              Explora necesidades abiertas y postúlate para ayudar.
            </p>
            <button
              type="button"
              onClick={onExplore}
              className="w-full rounded-2xl border border-info/40 bg-info/10 py-2.5 text-sm font-medium text-info"
            >
              Explorar necesidades
            </button>
          </>
        )}
      </GlassCard>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Necesidades abiertas</h2>
        <AvailableMissions />
      </div>
    </div>
  )
}

/**
 * Overlay global: si hay misión en curso, invade toda la app del voluntario
 * sin importar la pestaña activa.
 */
export function ImmersiveMissionGate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile, refetch: refetchProfile } = useVolunteerProfile()
  const volunteerRowId = profile?.id ?? ''
  const { data: assignments, refetch: refetchMissions } = useVolunteerMissions(volunteerRowId)
  const { data: allMissions } = useMissions()
  const respondMission = useRespondMission()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    loadDismissedMissionIds(user?.id),
  )
  const [forcedOpenId, setForcedOpenId] = useState<string | null>(null)
  const [forceSelection, setForceSelection] = useState(false)

  useEffect(() => {
    if (user?.id) setDismissedIds(loadDismissedMissionIds(user.id))
  }, [user?.id])

  // Asegura fila en volunteers para poder leer mission_assignments
  useEffect(() => {
    if (!user?.id || profile?.id) return
    let cancelled = false
    void (async () => {
      try {
        const { volunteerRepository } = await import('@/repositories/volunteer-repository')
        await volunteerRepository.ensureIdForUser(user.id)
        if (!cancelled) {
          await refetchProfile()
          void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerProfile] })
          void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerMissions] })
        }
      } catch {
        console.warn('[FARO_MISSION] No se pudo asegurar perfil de voluntario')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, profile?.id, refetchProfile, queryClient])

  const missionMap = useMemo(() => {
    const map = new Map<string, Mission>()
    for (const m of allMissions ?? []) map.set(m.id, m)
    return map
  }, [allMissions])

  const pendingSelection = useMemo(() => {
    const list = assignments ?? []
    return list.find((a) => a.status === 'assigned' && !dismissedIds.has(a.id)) ?? null
  }, [assignments, dismissedIds])

  const target = useMemo(() => {
    const list = assignments ?? []
    const immersive = list.find((a) =>
      (IMMERSIVE_MISSION_STATUSES as readonly string[]).includes(a.status),
    )
    if (immersive) return immersive
    if (forcedOpenId) {
      const forced = list.find((a) => a.id === forcedOpenId)
      if (
        forced &&
        forced.status !== 'rejected' &&
        forced.status !== 'cancelled' &&
        forced.status !== 'assigned'
      ) {
        return forced
      }
    }
    return (
      list.find(
        (a) =>
          (a.status === 'completed' || a.status === 'verified') && !dismissedIds.has(a.id),
      ) ?? null
    )
  }, [assignments, dismissedIds, forcedOpenId])

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ assignmentId?: string }>).detail
      if (detail?.assignmentId) {
        setForcedOpenId(detail.assignmentId)
      }
    }
    window.addEventListener('faro:open-immersive-mission', open)
    return () => window.removeEventListener('faro:open-immersive-mission', open)
  }, [])

  // Tras aceptación del GC: refrescar perfil/misiones y mostrar SelectedMissionModal
  useEffect(() => {
    const onAssigned = () => {
      setForceSelection(true)
      void (async () => {
        try {
          if (user?.id) {
            const { volunteerRepository } = await import('@/repositories/volunteer-repository')
            await volunteerRepository.ensureIdForUser(user.id)
          }
        } catch {
          /* ignore */
        }
        await refetchProfile()
        void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerProfile] })
        void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerMissions] })
        void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
        void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
        await refetchMissions()
      })()
    }
    window.addEventListener('faro:mission-assigned', onAssigned)
    return () => window.removeEventListener('faro:mission-assigned', onAssigned)
  }, [user?.id, refetchProfile, refetchMissions, queryClient])

  useEffect(() => {
    if (forceSelection && pendingSelection) {
      setForceSelection(false)
    }
  }, [forceSelection, pendingSelection])

  if (!user?.id) return null

  if (pendingSelection && !target) {
    const mission = missionMap.get(pendingSelection.missionId)
    return (
      <SelectedMissionModal
        missionTitle={mission?.title ?? 'Misión asignada'}
        mission={mission}
        isPending={respondMission.isPending}
        onStart={() =>
          respondMission.mutate({
            assignmentId: pendingSelection.id,
            action: 'accept',
            volunteerId: user.id,
          })
        }
        onReject={() =>
          respondMission.mutate({
            assignmentId: pendingSelection.id,
            action: 'reject',
            volunteerId: user.id,
          })
        }
      />
    )
  }

  // Esperando a que llegue la assignment tras aprobación (breve)
  if (forceSelection && !pendingSelection && !target) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
        <GlassCard className="w-full max-w-sm space-y-3 border-info/20 p-5 text-center">
          <p className="text-sm font-semibold text-ink">Preparando tu misión…</p>
          <p className="text-xs text-ink-muted">El gestor te seleccionó. Cargando protocolo.</p>
        </GlassCard>
      </div>
    )
  }

  if (!target) return null

  const mission = missionMap.get(target.missionId) ?? {
    id: target.missionId,
    title: 'Misión activa',
    description: '',
    priority: 'medium' as const,
    requiredSkills: [],
    requiredPeople: 1,
    assignedPeople: 1,
    status: target.status as Mission['status'],
    centerId: 'volunteer_pool',
    location: { lat: 0, lng: 0, zone: '' },
    createdBy: '',
    createdAt: target.assignedAt,
    updatedAt: target.assignedAt,
  }

  return (
    <ActiveMissionView
      mission={mission}
      assignment={target}
      volunteerId={user.id}
      onClose={() => {
        if (target.status === 'completed' || target.status === 'verified') {
          if (user?.id) {
            setDismissedIds(dismissMissionForUser(user.id, target.id))
          }
        }
        setForcedOpenId(null)
      }}
    />
  )
}

export function VolunteerWorkspace({
  initialTab = 'available',
}: {
  initialTab?: VolunteerTab
}) {
  const [tab, setTab] = useState<VolunteerTab>(initialTab)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  // Listen for navigation events from mission-detail-sheet
  useEffect(() => {
    const handler = () => setTab('my-missions')
    window.addEventListener('faro:nav-volunteer-missions', handler)
    return () => window.removeEventListener('faro:nav-volunteer-missions', handler)
  }, [])

  useRealtimeSync({
    channelName: 'volunteer-missions',
    tables: [
      'public_needs',
      'coverage_reservations',
      'missions',
      'mission_assignments',
      'mission_events',
      'mission_applications',
      'case_applications',
    ],
    invalidateKeys: [
      FARO_QUERY_KEYS.publicNeeds,
      FARO_QUERY_KEYS.coverage,
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.mission,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.missionEvents,
      FARO_QUERY_KEYS.missionApplications,
      FARO_QUERY_KEYS.volunteerMissions,
      FARO_QUERY_KEYS.caseApplications,
    ],
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 pt-safe pb-3 lg:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="text-lg font-semibold text-ink">Mi Centro de Misiones</h1>
        </div>
      </header>

      <div className="shrink-0 px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.id
                  ? 'border-info/50 bg-info/15 text-ink'
                  : 'border border-white/10 text-ink-subtle hover:bg-white/[0.04]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="faro-scroll px-4 pb-6 lg:pb-8">
        {tab === 'available' && (
          <MissionCenterHome onExplore={() => {
            /* scroll to needs below — already on center; jump to needs section via my-missions explore */
            const el = document.getElementById('volunteer-explore-needs')
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }} />
        )}
        {tab === 'my-missions' && <div className="pt-2"><MyMissions /></div>}
        {tab === 'history' && <div className="pt-2"><VolunteerHistory /></div>}
        {tab === 'profile' && <div className="pt-2"><ProfileSection /></div>}
      </div>
    </div>
  )
}
