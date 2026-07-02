import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useCoordinatorReports } from '@/hooks/useCoordinatorPanel'
import { useCoordinatorMutations } from '@/hooks/useCoordinatorMutations'
import type { InboxFilter } from '@/services/coordinator-service'
import { cn, timeAgo } from '@/lib/utils'
import type { Report } from '@/domain/models'

const FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: 'pending', label: 'Pendiente' },
  { id: 'approved', label: 'Aprobado' },
  { id: 'rejected', label: 'Rechazado' },
  { id: 'all', label: 'Todos' },
]

export function CoordinatorReportsInbox({
  focusReportId,
  onFocusReportClear,
}: {
  focusReportId?: string | null
  onFocusReportClear?: () => void
} = {}) {
  const [filter, setFilter] = useState<InboxFilter>('pending')
  const reports = useCoordinatorReports(filter)
  const [selected, setSelected] = useState<Report | null>(null)

  useEffect(() => {
    if (!focusReportId) return
    setFilter('pending')
    const report = reports.find((r) => r.id === focusReportId)
    if (report) {
      setSelected(report)
      onFocusReportClear?.()
    }
  }, [focusReportId, reports, onFocusReportClear])

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink">Bandeja de reportes ciudadanos</p>
      <p className="text-xs text-ink-subtle">
        Solo los reportes aprobados influyen en la información pública verificada.
      </p>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === f.id
                ? 'border-info/50 bg-info/15 text-ink'
                : 'border-white/10 bg-white/[0.04] text-ink-subtle',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reports.length === 0 ? (
        <GlassCard className="text-sm text-ink-muted">No hay reportes en esta bandeja.</GlassCard>
      ) : (
        reports.map((report) => (
          <button
            key={report.id}
            type="button"
            onClick={() => setSelected(report)}
            className="block w-full text-left"
          >
            <GlassCard className="space-y-1 transition-colors hover:bg-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <StatusChip status={report.status} />
                <span className="text-[11px] text-ink-faint">{timeAgo(report.createdAt)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-ink">{report.description}</p>
              <p className="text-xs text-ink-subtle">{report.source}</p>
            </GlassCard>
          </button>
        ))
      )}

      {selected && <ReportReviewSheet report={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function StatusChip({ status }: { status: Report['status'] }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-operational-soft px-2 py-0.5 text-[11px] text-operational">
        <CheckCircle2 className="h-3 w-3" /> Aprobado
      </span>
    )
  }
  if (status === 'discarded') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-ink-subtle">
        <XCircle className="h-3 w-3" /> Rechazado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">
      Pendiente
    </span>
  )
}

function ReportReviewSheet({ report, onClose }: { report: Report; onClose: () => void }) {
  const { reviewReport } = useCoordinatorMutations()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isPending = report.status === 'new'

  const review = async (status: 'verified' | 'dismissed') => {
    setError(null)
    try {
      await reviewReport.mutateAsync({
        id: report.id,
        status,
        reviewNotes: notes.trim() || undefined,
      })
      onClose()
    } catch {
      setError('No se pudo actualizar el reporte. Inténtalo nuevamente.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <GlassCard className="max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto">
        <p className="text-base font-semibold text-ink">Reporte ciudadano</p>
        <StatusChip status={report.status} />
        <p className="text-sm leading-relaxed text-ink-muted">{report.description}</p>
        <p className="text-xs text-ink-subtle">
          {report.source} · {timeAgo(report.createdAt)}
        </p>
        {isPending && (
          <textarea
            className="min-h-[80px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-info/60"
            placeholder="Notas de revisión (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
        {error && <p className="text-sm text-critical">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <EmergencyButton variant="glass" size="md" onClick={onClose}>
            Cerrar
          </EmergencyButton>
          {isPending && (
            <>
              <EmergencyButton
                variant="glass"
                size="md"
                className="text-critical"
                disabled={reviewReport.isPending}
                onClick={() => review('dismissed')}
              >
                Rechazar
              </EmergencyButton>
              <EmergencyButton
                variant="primary"
                size="md"
                className="col-span-2"
                disabled={reviewReport.isPending}
                onClick={() => review('verified')}
              >
                Aprobar reporte
              </EmergencyButton>
            </>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
