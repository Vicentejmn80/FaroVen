import { GlassCard } from '@/components/ui/glass-card'
import type { CaseRecord } from '@/types/case.types'
import { timeAgo } from '@/lib/utils'
import { CaseActionButtons } from './CaseActionButtons'

interface CaseDetailViewProps {
  caseItem: CaseRecord
  onCall: (caseItem: CaseRecord) => void
  onValidate: (caseItem: CaseRecord) => void
  onView: (caseItem: CaseRecord) => void
}

export function CaseDetailView({ caseItem, onCall, onValidate, onView }: CaseDetailViewProps) {
  return (
    <div className="space-y-4">
      <GlassCard className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Detalle del caso</p>
        <h1 className="text-xl font-semibold text-ink">{caseItem.title}</h1>
        <p className="text-sm text-ink-subtle">{caseItem.description}</p>
        <div className="text-xs text-ink-faint">Reportado {timeAgo(caseItem.reportedAt)}</div>
      </GlassCard>

      <GlassCard className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Contacto ciudadano</p>
        <p className="text-sm text-ink">{caseItem.reportedBy}</p>
        <p className="text-sm text-ink-subtle">{caseItem.contactPhone}</p>
      </GlassCard>

      <GlassCard className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Ubicación</p>
        <p className="text-sm text-ink">{caseItem.location}</p>
      </GlassCard>

      <GlassCard className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Asignación</p>
        <p className="text-sm text-ink">{caseItem.assignedTo ?? 'Sin asignar'}</p>
        {caseItem.notes && <p className="text-sm text-ink-subtle">{caseItem.notes}</p>}
      </GlassCard>

      <CaseActionButtons caseItem={caseItem} onCall={onCall} onValidate={onValidate} onView={onView} />
    </div>
  )
}
