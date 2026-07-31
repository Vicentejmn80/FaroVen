import { PIPELINE_STAGES, type PipelineStage } from '@/domain/case-lifecycle.types'

/**
 * Etapas canónicas del pipeline logístico humanitario FARO.
 * Se mapean a `pipeline_stage` existentes sin borrar columnas DB.
 */
export const OPS_CANONICAL_PHASES = {
  REVIEW: 'review',
  AWAITING_CENTER: 'awaiting_center',
  BRIGADE_DISPATCH: 'brigade_dispatch',
  OPEN_RADAR: 'open_radar',
  COVERAGE: 'coverage',
  EXECUTION: 'execution',
  VERIFY: 'verify',
  CLOSED: 'closed',
} as const

export type OpsCanonicalPhase = (typeof OPS_CANONICAL_PHASES)[keyof typeof OPS_CANONICAL_PHASES]

/** TTL de reserva de inventario voluntario → centro (minutos). */
export const INVENTORY_RESERVATION_TTL_MINUTES = 20

/** Opciones rápidas de cantidad para reservas (sin input libre). */
export const COVERAGE_QUICK_PICK_QTY = [5, 10, 20] as const

/**
 * Mapea un `pipeline_stage` DB a la fase canónica del comando.
 * `validating` es legacy: se trata como review (sin entrada nueva).
 */
export function stageToCanonicalPhase(stage: PipelineStage): OpsCanonicalPhase {
  switch (stage) {
    case PIPELINE_STAGES.NUEVO:
    case PIPELINE_STAGES.PENDING_REVIEW:
    case PIPELINE_STAGES.VALIDATING:
    case PIPELINE_STAGES.AWAITING_INFO:
      return OPS_CANONICAL_PHASES.REVIEW
    case PIPELINE_STAGES.AWAITING_CENTER_CONFIRMATION:
      return OPS_CANONICAL_PHASES.AWAITING_CENTER
    case PIPELINE_STAGES.OPEN_FOR_APPLICATIONS:
      return OPS_CANONICAL_PHASES.COVERAGE
    case PIPELINE_STAGES.ASSIGNED:
    case PIPELINE_STAGES.ACCEPTED:
    case PIPELINE_STAGES.IN_ATTENTION:
      return OPS_CANONICAL_PHASES.EXECUTION
    case PIPELINE_STAGES.RESOLVED:
      return OPS_CANONICAL_PHASES.VERIFY
    case PIPELINE_STAGES.ARCHIVED:
      return OPS_CANONICAL_PHASES.CLOSED
    default:
      return OPS_CANONICAL_PHASES.REVIEW
  }
}

/** ¿El GC puede abrir Radar en esta etapa? Solo review sin centros, o tras needs_volunteer. */
export function canOpenRadarInPhase(phase: OpsCanonicalPhase, opts?: { hasViableCenters?: boolean; centerNeedsVolunteer?: boolean }): boolean {
  if (opts?.centerNeedsVolunteer) return true
  if (phase === OPS_CANONICAL_PHASES.REVIEW && opts?.hasViableCenters === false) return true
  if (phase === OPS_CANONICAL_PHASES.COVERAGE) return false
  return false
}

/** ¿El GC debe preferir solicitud a centro? */
export function shouldPreferCenterRequest(phase: OpsCanonicalPhase, hasViableCenters: boolean): boolean {
  return phase === OPS_CANONICAL_PHASES.REVIEW && hasViableCenters
}

export const OPS_CANONICAL_PHASE_LABELS: Record<OpsCanonicalPhase, string> = {
  [OPS_CANONICAL_PHASES.REVIEW]: 'Revisión GC',
  [OPS_CANONICAL_PHASES.AWAITING_CENTER]: 'Esperando centro',
  [OPS_CANONICAL_PHASES.BRIGADE_DISPATCH]: 'Despacho brigada',
  [OPS_CANONICAL_PHASES.OPEN_RADAR]: 'Radar abierto',
  [OPS_CANONICAL_PHASES.COVERAGE]: 'Cobertura voluntarios',
  [OPS_CANONICAL_PHASES.EXECUTION]: 'Ejecución',
  [OPS_CANONICAL_PHASES.VERIFY]: 'Validación GC',
  [OPS_CANONICAL_PHASES.CLOSED]: 'Cerrado',
}
