import type { MissionAssignmentStatus } from './mission.types'

/**
 * Ciclo de ejecución de una misión, en orden operativo.
 *
 * Es la vista de ejecución sobre `mission_assignments.status`: el voluntario y
 * el gestor razonan en estas etapas, no en el estado agregado de la misión.
 */
export const MISSION_EXECUTION_STAGES = [
  'assigned',
  'accepted',
  'preparing',
  'en_route',
  'on_site',
  'in_progress',
  'completed',
  'verified',
  'archived',
] as const

export type MissionExecutionStage = (typeof MISSION_EXECUTION_STAGES)[number]

/** Etapas fuera del camino feliz: no forman parte de la barra de progreso. */
export const MISSION_EXECUTION_OFF_TRACK = ['rejected', 'cancelled'] as const

const STAGE_INDEX = new Map<string, number>(MISSION_EXECUTION_STAGES.map((stage, i) => [stage, i]))

export function isExecutionStage(status: string): status is MissionExecutionStage {
  return STAGE_INDEX.has(status)
}

/**
 * Acción que el voluntario puede ejecutar desde cada etapa.
 * `null` significa que la pelota está del lado del gestor.
 */
export const VOLUNTEER_NEXT_STAGE: Record<MissionAssignmentStatus, MissionExecutionStage | null> = {
  assigned: 'accepted',
  accepted: 'en_route',
  preparing: 'en_route',
  en_route: 'on_site',
  on_site: 'in_progress',
  in_progress: 'completed',
  completed: null,
  verified: null,
  rejected: null,
  cancelled: null,
  archived: null,
}

/** Etapas en las que la misión sigue viva para el voluntario. */
export function isExecutionActive(status: MissionAssignmentStatus): boolean {
  return (
    status !== 'verified' &&
    status !== 'archived' &&
    status !== 'rejected' &&
    status !== 'cancelled'
  )
}

/** El gestor debe validar la evidencia antes de cerrar. */
export function awaitsValidation(status: MissionAssignmentStatus): boolean {
  return status === 'completed'
}

/** Avance 0-100 a lo largo del camino feliz. */
export function executionProgress(status: MissionAssignmentStatus): number {
  const index = STAGE_INDEX.get(status)
  if (index === undefined) return 0
  return Math.round((index / (MISSION_EXECUTION_STAGES.length - 1)) * 100)
}

/** Marca temporal registrada al entrar en cada etapa, si la hay. */
export const EXECUTION_STAGE_TIMESTAMP_FIELD: Partial<
  Record<MissionExecutionStage, 'assignedAt' | 'respondedAt' | 'preparingAt' | 'arrivedAt' | 'completedAt' | 'verifiedAt'>
> = {
  assigned: 'assignedAt',
  accepted: 'respondedAt',
  preparing: 'preparingAt',
  on_site: 'arrivedAt',
  completed: 'completedAt',
  verified: 'verifiedAt',
}
