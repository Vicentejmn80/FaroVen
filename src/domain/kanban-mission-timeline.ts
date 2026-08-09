import type { MissionAssignmentStatus } from '@/domain/mission.types'

/** Pasos compactos en la tarjeta Kanban (EN PROGRESO). */
export const KANBAN_MISSION_STEPS = [
  {
    id: 'accepted',
    label: 'Aceptado',
    activeIcon: '✅',
    statuses: ['assigned', 'accepted', 'preparing'] as const,
  },
  {
    id: 'en_route',
    label: 'En camino',
    activeIcon: '🚗',
    statuses: ['en_route'] as const,
  },
  {
    id: 'on_site',
    label: 'Llegué',
    activeIcon: '📍',
    statuses: ['on_site', 'in_progress'] as const,
  },
  {
    id: 'completed',
    label: 'Entregado',
    activeIcon: '✅',
    statuses: ['completed', 'verified'] as const,
  },
] as const

export type KanbanMissionStepId = (typeof KANBAN_MISSION_STEPS)[number]['id']

export type KanbanStepState = 'done' | 'current' | 'pending'

export interface KanbanTimelineStep {
  id: KanbanMissionStepId
  label: string
  state: KanbanStepState
  icon: string
  detail?: string
}

export interface CaseMissionLive {
  caseId: string
  missionId: string
  assignmentId?: string
  assignmentStatus: MissionAssignmentStatus
  delayMinutes?: number | null
  latestEventAt?: Date | null
  /** Eventos de misión (para badge no visto). */
  events: Array<{ id: string; eventType: string; createdAt: Date; description?: string }>
}

function stepIndexForStatus(status: string): number {
  for (let i = 0; i < KANBAN_MISSION_STEPS.length; i++) {
    if ((KANBAN_MISSION_STEPS[i].statuses as readonly string[]).includes(status)) return i
  }
  // Si aún no arrancó ejecución, nada marcado como current
  if (status === 'rejected' || status === 'cancelled') return -1
  return 0
}

export function buildKanbanTimeline(
  status: MissionAssignmentStatus | string,
  options?: { delayMinutes?: number | null },
): { steps: KanbanTimelineStep[]; delayLabel?: string } {
  const currentIdx = stepIndexForStatus(status)
  const awaitingValidation = status === 'completed'

  const steps: KanbanTimelineStep[] = KANBAN_MISSION_STEPS.map((step, idx) => {
    let state: KanbanStepState = 'pending'
    if (currentIdx < 0) state = 'pending'
    else if (idx < currentIdx) state = 'done'
    else if (idx === currentIdx) state = 'current'
    else state = 'pending'

    let label = step.label
    let detail: string | undefined
    let icon = state === 'done' ? '✅' : state === 'current' ? step.activeIcon : '○'

    if (step.id === 'completed' && awaitingValidation && state === 'current') {
      label = 'Entregado'
      detail = 'Esperando validación del gestor'
      icon = '✅'
    }

    return { id: step.id, label, state, icon, detail }
  })

  const delayLabel =
    options?.delayMinutes != null && options.delayMinutes > 0
      ? `⏱️ Retraso ${options.delayMinutes} min`
      : undefined

  return { steps, delayLabel }
}
