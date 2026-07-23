import { useEffect, useMemo, useState } from 'react'
import { useVolunteerProfile, useVolunteerMissions, useUpdateVolunteerAvailability } from '@/hooks/useVolunteerProfile'
import { useMissions } from '@/hooks/useMissions'
import { useRespondMission, useUpdateMissionAssignment } from '@/hooks/useMissionMutations'
import { useApplyToMission } from '@/hooks/useMissionApplications'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { VolunteerMissionCard } from './volunteer-mission-card'
import { GlassCard } from '@/components/ui/glass-card'
import { LiveTrackingCard } from '@/components/dispatch/live-tracking-card'
import { OperationalTimeline, type TimelineStep } from '@/components/dispatch/operational-timeline'
import { VOLUNTEER_AVAILABILITY, VOLUNTEER_AVAILABILITY_LABELS, VOLUNTEER_AVAILABILITY_TONES, VERIFICATION_LEVEL_LABELS, SKILL_LABELS } from '@/domain/volunteer.types'
import { MISSION_STAGES } from '@/domain/mission.types'
import type { Mission, MissionAssignment } from '@/domain/mission.types'
import { useAuth, usePermissions } from '@/store/auth-context'
import { cn } from '@/lib/utils'
import { animate } from 'framer-motion'
import { Flag } from 'lucide-react'
import { ASSIGNMENT_STATUS_LABELS, label } from '@/lib/labels'

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
  const { data: allMissions, isLoading, error } = useMissions()
  const missions = useMemo(() => allMissions?.filter((m) => m.status === MISSION_STAGES.MATCHING || m.status === MISSION_STAGES.ASSIGNED) ?? [], [allMissions])
  const { user } = useAuth()
  const { isVolunteer } = usePermissions()
  const { data: profile } = useVolunteerProfile()
  const { data: myAssignments } = useVolunteerMissions(profile?.id ?? '')
  const respond = useRespondMission()
  const applyToMission = useApplyToMission()
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  const assignmentMap = useMemo(() => {
    const map = new Map<string, MissionAssignment>()
    if (myAssignments) {
      for (const a of myAssignments) {
        map.set(a.missionId, a)
      }
    }
    return map
  }, [myAssignments])

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

  if (!missions || missions.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-2 p-6 text-center">
        <Flag className="h-8 w-8 text-ink-faint" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No hay misiones disponibles</p>
        <p className="text-xs text-ink-subtle">
          Cuando el gestor publique nuevas necesidades, aparecerán aquí para postularte.
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {missions.map((m) => {
        const assignment = assignmentMap.get(m.id)
        const realAssignment = assignment ?? { id: '', missionId: m.id, volunteerId: '', status: 'assigned' as const, assignedAt: new Date(), evidenceUrls: [] }
        const hasRealAssignment = !!assignment
        const alreadyApplied = appliedIds.has(m.id)
        const canApply = isVolunteer && !!profile && !hasRealAssignment && !alreadyApplied
        return (
          <VolunteerMissionCard
            key={m.id}
            mission={m}
            assignment={realAssignment}
            onAccept={hasRealAssignment && isVolunteer && user ? () => respond.mutate({ assignmentId: assignment!.id, action: 'accept', volunteerId: profile?.id ?? user.id }) : undefined}
            onReject={hasRealAssignment && isVolunteer && user ? () => respond.mutate({ assignmentId: assignment!.id, action: 'reject', volunteerId: profile?.id ?? user.id }) : undefined}
            onApply={canApply ? () => {
              applyToMission.mutate({ missionId: m.id, volunteerId: profile!.id })
              setAppliedIds((prev) => new Set(prev).add(m.id))
            } : undefined}
            applied={alreadyApplied}
          />
        )
      })}
    </div>
  )
}

function MyMissions() {
  const { data: profile } = useVolunteerProfile()
  const { data: assignments, isLoading } = useVolunteerMissions(profile?.id ?? '')
  const { data: allMissions } = useMissions()
  const updateStatus = useUpdateMissionAssignment()
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

  const activeStatuses: string[] = ['assigned', 'accepted', 'en_route', 'on_site']
  const activeAssignments = assignments.filter((a) => activeStatuses.includes(a.status))
  const pastAssignments = assignments.filter((a) => !activeStatuses.includes(a.status))

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
              status: a.status as any,
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
              { id: 'en_route', label: 'En camino', completed: ['en_route', 'on_site', 'completed'].includes(a.status), active: a.status === 'en_route' },
              { id: 'on_site', label: 'En el sitio', completed: ['on_site', 'completed'].includes(a.status), active: a.status === 'on_site' },
              { id: 'completed', label: 'Completada', completed: a.status === 'completed', active: a.status === 'completed' },
            ]
            return (
              <div key={a.id}>
                <button onClick={() => setExpandedMissionId(isExpanded ? null : a.id)} className="w-full text-left">
                  <VolunteerMissionCard
                    mission={realMission}
                    assignment={a}
                    onUpdateStatus={(status) => {
                      updateStatus.mutate({ assignmentId: a.id, status })
                    }}
                  />
                </button>
                {isExpanded && (
                  <div className="space-y-3 px-1 pt-2 pb-4">
                    <LiveTrackingCard
                      missionLat={realMission.location.lat}
                      missionLng={realMission.location.lng}
                      missionAddress={realMission.location.zone ?? `${realMission.location.lat.toFixed(4)}, ${realMission.location.lng.toFixed(4)}`}
                      volunteerUserId={profile?.id}
                    />
                    <div className="bg-white/[0.03] rounded-2xl p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-3">Progreso</p>
                      <OperationalTimeline steps={timelineSteps} />
                    </div>
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
  { id: 'available', label: 'Disponibles' },
  { id: 'my-missions', label: 'Mis misiones' },
  { id: 'history', label: 'Historial' },
  { id: 'profile', label: 'Perfil' },
]

export function VolunteerWorkspace({
  initialTab = 'available',
}: {
  initialTab?: VolunteerTab
}) {
  const [tab, setTab] = useState<VolunteerTab>(initialTab)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  useRealtimeSync({
    channelName: 'volunteer-missions',
    tables: ['missions', 'mission_assignments', 'mission_events', 'mission_applications'],
    invalidateKeys: [
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.mission,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.missionEvents,
      FARO_QUERY_KEYS.missionApplications,
      FARO_QUERY_KEYS.volunteerMissions,
    ],
  })

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pt-safe pb-3 lg:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="text-lg font-semibold text-ink">Voluntarios</h1>
        </div>
      </header>

      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto">
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

      <div className="flex-1 overflow-y-auto px-4 pb-32 lg:pb-8">
        {tab === 'available' && (
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-semibold text-ink">Misiones disponibles</h2>
            <AvailableMissions />
          </div>
        )}
        {tab === 'my-missions' && <div className="pt-2"><MyMissions /></div>}
        {tab === 'history' && <div className="pt-2"><MyMissions /></div>}
        {tab === 'profile' && <div className="pt-2"><ProfileSection /></div>}
      </div>
    </div>
  )
}
