import { GlassCard } from '@/components/ui/glass-card'
import type { CaseRecord, CaseStatus } from '@/types/case.types'
import { cn, timeAgo } from '@/lib/utils'
import { CaseActionButtons } from './CaseActionButtons'

interface CaseCardProps {
  caseItem: CaseRecord
  onCall: (caseItem: CaseRecord) => void
  onValidate: (caseItem: CaseRecord) => void
  onView: (caseItem: CaseRecord) => void
  showStatus?: boolean
}

const STATUS_LABELS: Record<CaseStatus, string> = {
  pending: 'Pendiente',
  review: 'Revisión',
  waiting: 'Espera',
  followup: 'Seguimiento',
  resolved: 'Resuelto',
}

const PRIORITY_STYLES: Record<CaseRecord['priority'], { dot: string; label: string; text: string }> = {
  high: { dot: 'bg-critical', label: 'Alta', text: 'text-critical' },
  medium: { dot: 'bg-warning', label: 'Media', text: 'text-warning' },
  low: { dot: 'bg-operational', label: 'Baja', text: 'text-operational' },
}

export function CaseCard({ caseItem, onCall, onValidate, onView, showStatus = true }: CaseCardProps) {
  const priority = PRIORITY_STYLES[caseItem.priority]
  return (
    <GlassCard inset={false} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className={cn('h-2.5 w-2.5 rounded-full', priority.dot)} aria-hidden />
            <span className={cn('font-semibold uppercase tracking-[0.12em]', priority.text)}>
              {priority.label}
            </span>
          </div>
          <p className="text-base font-semibold text-ink">{caseItem.title}</p>
          <p className="text-xs text-ink-subtle">
            {caseItem.location} · Reportado por {caseItem.reportedBy}
          </p>
        </div>
        <span className="text-xs text-ink-faint">{timeAgo(caseItem.reportedAt)}</span>
      </div>
      {showStatus && (
        <div className="text-xs text-ink-subtle">
          Estado: <span className="text-ink">{STATUS_LABELS[caseItem.status]}</span>
        </div>
      )}
      <CaseActionButtons caseItem={caseItem} onCall={onCall} onValidate={onValidate} onView={onView} compact />
    </GlassCard>
  )
}
