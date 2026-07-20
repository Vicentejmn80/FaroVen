import { useMemo, useState } from 'react'
import { useVolunteerProfile, useVolunteerMissions, useUpdateVolunteerAvailability } from '@/hooks/useVolunteerProfile'
import { useMissions } from '@/hooks/useMissions'
import { useRespondMission, useUpdateMissionAssignment } from '@/hooks/useMissionMutations'
import { VolunteerMissionCard } from './volunteer-mission-card'
import { GlassCard } from '@/components/ui/glass-card'
import { VOLUNTEER_AVAILABILITY, VOLUNTEER_AVAILABILITY_LABELS, VOLUNTEER_AVAILABILITY_TONES, VERIFICATION_LEVEL_LABELS, SKILL_LABELS } from '@/domain/volunteer.types'
import { MISSION_STAGES } from '@/domain/mission.types'
import type { Mission, MissionAssignment } from '@/domain/mission.types'
import { useAuth } from '@/store/auth-context'
import { cn } from '@/lib/utils'

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

function AvailableMissions() {
  const { data: missions, isLoading, error } = useMissions({ status: MISSION_STAGES.ASSIGNED })
  const { user } = useAuth()
  const { data: profile } = useVolunteerProfile()
  const { data: myAssignments } = useVolunteerMissions(profile?.id ?? '')
  const respond = useRespondMission()

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
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-ink-subtle">No hay misiones disponibles en este momento</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {missions.map((m) => {
        const assignment = assignmentMap.get(m.id)
        const realAssignment = assignment ?? { id: '', missionId: m.id, volunteerId: '', status: 'assigned' as const, assignedAt: new Date() }
        const hasRealAssignment = !!assignment
        return (
          <VolunteerMissionCard
            key={m.id}
            mission={m}
            assignment={realAssignment}
            onAccept={hasRealAssignment && user ? () => respond.mutate({ assignmentId: assignment!.id, action: 'accept', volunteerId: user.id }) : undefined}
            onReject={hasRealAssignment && user ? () => respond.mutate({ assignmentId: assignment!.id, action: 'reject', volunteerId: user.id }) : undefined}
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

  const activeStatuses = ['assigned', 'accepted', 'en_route', 'on_site', 'in_progress']
  const activeAssignments = assignments.filter((a) => activeStatuses.includes(a.status))
  const pastAssignments = assignments.filter((a) => !activeStatuses.includes(a.status))

  return (
    <div className="space-y-4">
      {activeAssignments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Misiones activas ({activeAssignments.length})</h3>
          {activeAssignments.map((a) => {
            const m = missionMap.get(a.missionId)
            return (
              <VolunteerMissionCard
                key={a.id}
                mission={m ?? {
                  id: a.missionId,
                  title: 'Misión',
                  description: '',
                  priority: 'medium',
                  requiredSkills: [],
                  requiredPeople: 1,
                  assignedPeople: 1,
                  status: a.status as any,
                  centerId: '',
                  location: { lat: 0, lng: 0 },
                  createdBy: '',
                  createdAt: a.assignedAt,
                  updatedAt: a.assignedAt,
                }}
                assignment={a}
                onUpdateStatus={(status) => {
                  updateStatus.mutate({ assignmentId: a.id, status })
                }}
              />
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
                  <span className="text-ink-subtle">{a.status}</span>
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
        <h4 className="text-xs font-semibold text-ink mb-3">Métricas</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Confianza', value: `${profile.trustScore}%` },
            { label: 'Misiones', value: `${profile.completedMissions}/${profile.totalMissions}` },
            { label: 'Horas', value: `${profile.serviceHours}h` },
            { label: 'Respuesta', value: `${profile.avgResponseMinutes}min` },
            { label: 'Verificación', value: VERIFICATION_LEVEL_LABELS[profile.verificationLevel]?.split(' ')[0] ?? 'N/A' },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 rounded-lg p-2 text-center">
              <p className="text-lg font-semibold text-ink">{m.value}</p>
              <p className="text-[10px] text-ink-faint">{m.label}</p>
            </div>
          ))}
        </div>
      </GlassCard>

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

export function VolunteerWorkspace() {
  const [tab, setTab] = useState<VolunteerTab>('available')

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
