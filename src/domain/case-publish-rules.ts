import { PIPELINE_STAGES, type PipelineStage } from '@/domain/case-lifecycle.types'
import { isProgressStage } from '@/domain/ops-pipeline'

/** Etapas donde el gestor puede publicar / abrir convocatoria en el radar. */
const PUBLISHABLE_STAGES: readonly PipelineStage[] = [
  PIPELINE_STAGES.NUEVO,
  PIPELINE_STAGES.PENDING_REVIEW,
  PIPELINE_STAGES.VALIDATING,
  PIPELINE_STAGES.AWAITING_INFO,
  PIPELINE_STAGES.OPEN_FOR_APPLICATIONS,
  PIPELINE_STAGES.AWAITING_CENTER_CONFIRMATION,
]

export function canPublishNeed(pipelineStage: PipelineStage): boolean {
  return PUBLISHABLE_STAGES.includes(pipelineStage)
}

export function isTerminalCaseStage(pipelineStage: PipelineStage): boolean {
  return (
    pipelineStage === PIPELINE_STAGES.RESOLVED || pipelineStage === PIPELINE_STAGES.ARCHIVED
  )
}

/** Mensaje contextual cuando no se puede publicar (estados finales o misión activa). */
export function getPublishContextMessage(
  pipelineStage: PipelineStage,
  resolvedAt?: Date | null,
): string | null {
  if (isProgressStage(pipelineStage)) {
    return 'Misión activa — Ver timeline'
  }
  if (isTerminalCaseStage(pipelineStage)) {
    if (resolvedAt) {
      try {
        const label = resolvedAt.toLocaleDateString('es-VE', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        return `Caso cerrado el ${label}`
      } catch {
        return 'Caso cerrado'
      }
    }
    return pipelineStage === PIPELINE_STAGES.ARCHIVED
      ? 'Caso archivado en historial de éxito'
      : 'Caso cerrado'
  }
  return null
}

export function priorityLabel(priority: string): { text: string; tone: string } {
  switch (priority) {
    case 'critical':
      return { text: 'CRÍTICA', tone: 'text-critical' }
    case 'high':
      return { text: 'ALTA', tone: 'text-critical' }
    case 'medium':
      return { text: 'MEDIA', tone: 'text-warning' }
    default:
      return { text: 'BAJA', tone: 'text-operational' }
  }
}
