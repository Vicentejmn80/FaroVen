import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/domain/case-lifecycle.types'
import { stageToBoardColumn } from '@/domain/ops-pipeline'

interface CaseStatusBadgeProps {
  stage: PipelineStage
  className?: string
}

const BOARD_META: Record<
  NonNullable<ReturnType<typeof stageToBoardColumn>>,
  { label: string; color: string; bg: string }
> = {
  nuevo: { label: 'Nuevo', color: 'text-info', bg: 'bg-info/10' },
  en_revision: { label: 'En revisión', color: 'text-warning', bg: 'bg-warning/10' },
  esperando_cobertura: { label: 'Esperando cobertura', color: 'text-info', bg: 'bg-info/10' },
  en_progreso: { label: 'En progreso', color: 'text-operational', bg: 'bg-operational/10' },
  resuelto: { label: 'Resuelto', color: 'text-operational', bg: 'bg-operational/10' },
}

const FALLBACK = { label: 'Archivado', color: 'text-ink-muted', bg: 'bg-white/[0.04]' }

export function CaseStatusBadge({ stage, className }: CaseStatusBadgeProps) {
  const col = stageToBoardColumn(stage)
  const meta = col ? BOARD_META[col] : FALLBACK
  const infoHint = stage === 'awaiting_info' ? ' · info pendiente' : ''
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
      {infoHint}
    </span>
  )
}
