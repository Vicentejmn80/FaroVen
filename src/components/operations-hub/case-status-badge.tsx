import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/domain/case-lifecycle.types'

interface CaseStatusBadgeProps {
  stage: PipelineStage
  className?: string
}

const STAGE_META: Record<PipelineStage, { label: string; color: string; bg: string }> = {
  nuevo: { label: 'Nuevo', color: 'text-info', bg: 'bg-info/10' },
  pending_review: { label: 'En revisión', color: 'text-warning', bg: 'bg-warning/10' },
  validating: { label: 'Planificando', color: 'text-warning', bg: 'bg-warning/10' },
  awaiting_info: { label: 'Monitoreando', color: 'text-ink-muted', bg: 'bg-white/[0.06]' },
  open_for_applications: { label: 'Esperando postulantes', color: 'text-info', bg: 'bg-info/10' },
  awaiting_center_confirmation: { label: 'Esperando centro', color: 'text-warning', bg: 'bg-warning/10' },
  assigned: { label: 'Asignado', color: 'text-info', bg: 'bg-info/10' },
  accepted: { label: 'Ejecucion', color: 'text-operational', bg: 'bg-operational/10' },
  in_attention: { label: 'Ejecucion', color: 'text-operational', bg: 'bg-operational/10' },
  resolved: { label: 'Completado', color: 'text-operational', bg: 'bg-operational/10' },
  archived: { label: 'Archivado', color: 'text-ink-muted', bg: 'bg-white/[0.04]' },
}

export function CaseStatusBadge({ stage, className }: CaseStatusBadgeProps) {
  const meta = STAGE_META[stage]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        meta.color,
        meta.bg,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
