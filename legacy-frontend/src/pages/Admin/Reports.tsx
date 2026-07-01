import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { useAdminReports, useUpdateReport } from '@/hooks/useAdmin'
import { formatDate } from '@/lib/utils'
import type { AdminReport, ReportStatus } from '@/lib/types'
import { REPORT_TYPE_LABELS, REPORT_STATUS_LABELS } from '@/lib/types'

const STATUS_FILTERS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'under_review', label: 'En revisión' },
  { value: 'verified', label: 'Verificados' },
  { value: 'dismissed', label: 'Descartados' },
]

const STATUS_VARIANT: Record<ReportStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  under_review: 'info' as 'default',
  verified: 'success',
  dismissed: 'danger',
}

function ReportCard({ report, onAction }: {
  report: AdminReport
  onAction: (id: string, status: ReportStatus, notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState(report.review_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [localStatus, setLocalStatus] = useState<ReportStatus>(report.status)
  const [error, setError] = useState<string | null>(null)

  const act = async (status: ReportStatus) => {
    setError(null)
    setBusy(true)
    try {
      await onAction(report.id, status, notes)
      setLocalStatus(status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setBusy(false)
    }
  }

  const isDone = localStatus === 'verified' || localStatus === 'dismissed'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              {REPORT_TYPE_LABELS[report.type]}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(report.created_at)}</p>
          </div>
          <Badge variant={STATUS_VARIANT[localStatus] ?? 'default'}>
            {REPORT_STATUS_LABELS[localStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{report.description}</p>

        {report.contact_info && (
          <p className="text-xs text-muted-foreground">Contacto: {report.contact_info}</p>
        )}
        {report.reported_by && (
          <p className="text-xs text-muted-foreground">Reportado por: {report.reported_by}</p>
        )}

        {!isDone && (
          <>
            <textarea
              className="input text-sm"
              placeholder="Notas de revisión (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: 72, resize: 'vertical' }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => act('under_review')} disabled={busy}>
                Marcar en revisión
              </Button>
              <Button size="sm" onClick={() => act('verified')} disabled={busy}>
                Verificar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => act('dismissed')} disabled={busy}>
                Descartar
              </Button>
            </div>
          </>
        )}

        {isDone && report.review_notes && (
          <p className="text-xs text-muted-foreground italic">Nota: {report.review_notes}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminReportsPage() {
  const [filter, setFilter] = useState<ReportStatus | 'all'>('pending')
  const { data: reports, isLoading, error, refetch } = useAdminReports(
    filter === 'all' ? undefined : filter
  )
  const updateReport = useUpdateReport()

  const handleAction = async (id: string, status: ReportStatus, review_notes: string) => {
    await updateReport.mutateAsync({ id, status, review_notes })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold mb-1">Reportes ciudadanos</h1>
        <p className="text-sm text-muted-foreground">
          Cola de informes enviados por el público. Márcalos como verificados o descártalos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as ReportStatus | 'all')}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage title="Error al cargar reportes" onRetry={refetch} />}

      {!isLoading && !error && (
        <>
          {!reports?.length ? (
            <p className="text-center text-muted-foreground py-10">No hay reportes en esta categoría.</p>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <ReportCard key={r.id} report={r} onAction={handleAction} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
