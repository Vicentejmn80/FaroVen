import { PIPELINE_STAGES, type PipelineStage } from '@/domain/case-lifecycle.types'

/**
 * Columnas del tablero operacional FARO.
 * Representan el ciclo de vida real de una necesidad — no acciones del gestor.
 * Los movimientos son automáticos vía dominio; no hay drag-and-drop.
 */
export const OPS_BOARD_COLUMNS = [
  {
    id: 'nuevo',
    label: 'Nuevo',
    description: 'Reportes / solicitudes recién recibidos',
    stages: [PIPELINE_STAGES.NUEVO] as readonly PipelineStage[],
    accent: 'border-t-info',
    header: 'text-info',
  },
  {
    id: 'en_revision',
    label: 'En revisión',
    description: 'Clasificación, duplicados y decisión de cobertura',
    stages: [
      PIPELINE_STAGES.PENDING_REVIEW,
      PIPELINE_STAGES.VALIDATING,
      PIPELINE_STAGES.AWAITING_INFO,
    ] as readonly PipelineStage[],
    accent: 'border-t-warning',
    header: 'text-warning',
  },
  {
    id: 'esperando_cobertura',
    label: 'Esperando cobertura',
    description: 'Voluntarios, instituciones y centros disponibles',
    stages: [
      PIPELINE_STAGES.OPEN_FOR_APPLICATIONS,
      PIPELINE_STAGES.AWAITING_CENTER_CONFIRMATION,
    ] as readonly PipelineStage[],
    accent: 'border-t-info',
    header: 'text-info',
  },
  {
    id: 'en_progreso',
    label: 'En progreso',
    description: 'Misión activa — timeline en vivo',
    stages: [
      PIPELINE_STAGES.ASSIGNED,
      PIPELINE_STAGES.ACCEPTED,
      PIPELINE_STAGES.IN_ATTENTION,
    ] as readonly PipelineStage[],
    accent: 'border-t-operational',
    header: 'text-operational',
  },
  {
    id: 'resuelto',
    label: 'Resuelto',
    description: 'Validado por el gestor',
    stages: [PIPELINE_STAGES.RESOLVED] as readonly PipelineStage[],
    accent: 'border-t-operational',
    header: 'text-operational',
  },
] as const

export type OpsBoardColumnId = (typeof OPS_BOARD_COLUMNS)[number]['id']

/** Mapea un pipeline_stage a la columna del tablero. */
export function stageToBoardColumn(stage: PipelineStage): OpsBoardColumnId | null {
  for (const col of OPS_BOARD_COLUMNS) {
    if ((col.stages as readonly PipelineStage[]).includes(stage)) return col.id
  }
  return null
}

export function isCoverageStage(stage: PipelineStage): boolean {
  return (
    stage === PIPELINE_STAGES.OPEN_FOR_APPLICATIONS ||
    stage === PIPELINE_STAGES.AWAITING_CENTER_CONFIRMATION
  )
}

export function isProgressStage(stage: PipelineStage): boolean {
  return (
    stage === PIPELINE_STAGES.ASSIGNED ||
    stage === PIPELINE_STAGES.ACCEPTED ||
    stage === PIPELINE_STAGES.IN_ATTENTION
  )
}

export function isReviewStage(stage: PipelineStage): boolean {
  return (
    stage === PIPELINE_STAGES.PENDING_REVIEW ||
    stage === PIPELINE_STAGES.VALIDATING ||
    stage === PIPELINE_STAGES.AWAITING_INFO
  )
}
