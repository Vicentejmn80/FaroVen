import { useState } from 'react'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useMissionsByCenter, useMissionTimeline, useMissionAssignments } from '@/hooks/useMissions'
import { useCreateMission, useStartMatching, useTransitionMission } from '@/hooks/useMissionMutations'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { MISSION_STAGES, MISSION_STAGE_LABELS, MISSION_STAGE_TONES, type Mission, type MissionStage } from '@/domain/mission.types'
import { cn, timeAgo } from '@/lib/utils'
import { useAuth } from '@/store/auth-context'

function StageBadge({ stage }: { stage: string }) {
  const tone = MISSION_STAGE_TONES[stage as MissionStage] ?? 'bg-white/10 text-ink-faint'
  const label = MISSION_STAGE_LABELS[stage as MissionStage] ?? stage
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>
      {label}
    </span>
  )
}

function CreateMissionForm({ centerId, onClose }: { centerId: string; onClose: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [requiredPeople, setRequiredPeople] = useState(1)
  const [skillsInput, setSkillsInput] = useState('')
  const create = useCreateMission()

  const handleSubmit = async () => {
    if (!user) return
    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    await create.mutateAsync({
      centerId,
      title,
      description,
      priority,
      requiredSkills: skills,
      requiredPeople,
      location: { lat: 0, lng: 0, zone: '' },
      createdBy: user.id,
    })
    onClose()
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-ink">Nueva misión</h3>
      <div>
        <label className="block text-xs text-ink-subtle mb-1">Título</label>
        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          placeholder="Ej: Apoyo médico en El Valle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-ink-subtle mb-1">Descripción</label>
        <textarea
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-faint resize-none"
          rows={3}
          placeholder="Detalles de la misión..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ink-subtle mb-1">Prioridad</label>
          <select
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-subtle mb-1">Voluntarios requeridos</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
            value={requiredPeople}
            onChange={(e) => setRequiredPeople(Math.max(1, Number(e.target.value)))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-ink-subtle mb-1">Habilidades requeridas (separadas por coma)</label>
        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          placeholder="paramedic, driver, rescuer"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <EmergencyButton
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={create.isPending || !title.trim()}
        >
          {create.isPending ? 'Creando...' : 'Crear misión'}
        </EmergencyButton>
        <EmergencyButton variant="glass" size="sm" onClick={onClose}>
          Cancelar
        </EmergencyButton>
      </div>
    </div>
  )
}

function MissionCard({ mission }: { mission: Mission }) {
  const { data: events } = useMissionTimeline(mission.id)
  const { data: assignments } = useMissionAssignments(mission.id)
  const [showDetail, setShowDetail] = useState(false)
  const startMatching = useStartMatching()
  const transition = useTransitionMission()
  const { user } = useAuth()

  const primary = assignments?.find((a) =>
    !['rejected', 'cancelled'].includes(a.status),
  ) ?? assignments?.[0]

  const statusLabel = (() => {
    if (!primary) return MISSION_STAGE_LABELS[mission.status as MissionStage] ?? mission.status
    if (primary.status === 'assigned') return 'Pendiente de aceptación'
    if (primary.status === 'accepted' || primary.status === 'preparing') return 'Preparándose'
    if (primary.status === 'en_route') return 'En camino'
    if (primary.status === 'on_site' || primary.status === 'in_progress') return 'En sitio'
    if (primary.status === 'completed') return 'Esperando evidencia'
    if (primary.status === 'verified') return 'Verificada'
    return MISSION_STAGE_LABELS[mission.status as MissionStage] ?? primary.status
  })()

  const etaLabel = mission.eta
    ? `ETA ${Math.max(1, Math.round((new Date(mission.eta).getTime() - Date.now()) / 60000))} min`
    : primary?.status === 'en_route'
      ? 'En tránsito'
      : null

  const canStartMatching = mission.status === MISSION_STAGES.CREATED
  const canCancel = !['completed', 'verified', 'archived', 'cancelled'].includes(mission.status)
  const canVerify = mission.status === MISSION_STAGES.COMPLETED

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">
            {primary ? `Voluntario · ${primary.volunteerId.slice(0, 8)}` : mission.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">{statusLabel}</p>
          {etaLabel && <p className="mt-0.5 text-xs text-info">{etaLabel}</p>}
        </div>
        <StageBadge stage={primary?.status ?? mission.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <EmergencyButton variant="glass" size="sm" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? 'Ocultar' : 'Ver detalles'}
        </EmergencyButton>
        {canStartMatching && (
          <EmergencyButton
            variant="primary"
            size="sm"
            onClick={() => startMatching.mutate({ missionId: mission.id })}
            disabled={startMatching.isPending}
          >
            Buscar voluntarios
          </EmergencyButton>
        )}
        {canVerify && (
          <EmergencyButton
            variant="primary"
            size="sm"
            onClick={() =>
              transition.mutate({
                missionId: mission.id,
                toStage: MISSION_STAGES.VERIFIED,
                actorId: user?.id,
              })
            }
            disabled={transition.isPending}
          >
            Verificar
          </EmergencyButton>
        )}
        {canCancel && (
          <EmergencyButton
            variant="glass"
            size="sm"
            onClick={() =>
              transition.mutate({
                missionId: mission.id,
                toStage: MISSION_STAGES.CANCELLED,
                comment: 'Cancelada por coordinador',
                actorId: user?.id,
              })
            }
            disabled={transition.isPending}
          >
            Cancelar
          </EmergencyButton>
        )}
      </div>

      {showDetail && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <p className="text-xs text-ink-subtle">{mission.title}</p>
          {mission.description && (
            <p className="text-xs text-ink-muted">{mission.description}</p>
          )}
          {events && events.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-subtle">Línea de tiempo</p>
              <div className="space-y-1.5">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2 text-xs text-ink-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                    <span>{ev.description ?? ev.eventType}</span>
                    <span className="ml-auto">{timeAgo(ev.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

export function CoordinatorMissionPanel() {
  const { assignment } = useCoordinatorAssignment()
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<MissionStage | 'all'>('all')
  const { data: missions, isLoading, error } = useMissionsByCenter(assignment?.siteId ?? '')

  if (!assignment) {
    return (
      <div className="p-4 text-center text-sm text-ink-muted">
        No tienes un centro asignado
      </div>
    )
  }

  if (showForm) {
    return (
      <CreateMissionForm centerId={assignment.siteId} onClose={() => setShowForm(false)} />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2].map((i) => (
          <GlassCard key={i} className="h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-sm text-critical">
        Error: {(error as Error).message}
      </div>
    )
  }

  const activeStages: MissionStage[] = [
    MISSION_STAGES.CREATED,
    MISSION_STAGES.MATCHING,
    MISSION_STAGES.ASSIGNED,
    MISSION_STAGES.ACCEPTED,
    MISSION_STAGES.EN_ROUTE,
    MISSION_STAGES.ON_SITE,
    MISSION_STAGES.IN_PROGRESS,
  ]

  const filtered = missions
    ? filter === 'all'
      ? missions
      : missions.filter((m) => m.status === filter)
    : []

  const activeMissions = missions?.filter((m) => activeStages.includes(m.status)) ?? []
  const completedMissions = missions?.filter((m) => !activeStages.includes(m.status)) ?? []

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">
          Misiones
          {activeMissions.length > 0 && (
            <span className="ml-2 text-xs text-ink-subtle font-normal">
              ({activeMissions.length} activas)
            </span>
          )}
        </h3>
        <EmergencyButton variant="primary" size="sm" onClick={() => setShowForm(true)}>
          Nueva misión
        </EmergencyButton>
      </div>

      {(!missions || missions.length === 0) ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-ink-subtle">No hay misiones para este centro</p>
        </GlassCard>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {(['all', ...activeStages] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filter === s
                    ? 'border-info/50 bg-info/15 text-ink'
                    : 'border-white/10 bg-white/[0.04] text-ink-subtle hover:bg-white/[0.08]',
                )}
              >
                {s === 'all' ? 'Todas' : MISSION_STAGE_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>

          {filter === 'all' && completedMissions.length > 0 && (
            <div className="pt-4">
              <h4 className="text-xs font-medium text-ink-subtle mb-3">
                Misiones finalizadas ({completedMissions.length})
              </h4>
              <div className="space-y-2">
                {completedMissions.map((m) => (
                  <GlassCard key={m.id} className="p-3 opacity-70">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">{m.title}</p>
                        <p className="text-xs text-ink-subtle">{timeAgo(m.createdAt)}</p>
                      </div>
                      <StageBadge stage={m.status} />
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
