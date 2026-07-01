import { useState } from 'react'
import {
  useCoordinatorPendingReports,
  useUpdateCoordinatorReport,
} from '@/hooks/useCoordinatorReports'
import { formatDate } from '@/lib/utils'
import { REPORT_TYPE_LABELS, type CoordinatorReport, type ReportStatus } from '@/lib/types'

function extractReportSource(description: string): string | null {
  const line = description.split('\n').find((l) => l.startsWith('Origen del reporte:'))
  return line ? line.replace(/^Origen del reporte:\s*/, '').trim() : null
}

function ReportRow({
  report,
  onAction,
}: {
  report: CoordinatorReport
  onAction: (status: ReportStatus, notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const source = extractReportSource(report.description)

  const act = async (status: ReportStatus) => {
    setBusy(true)
    try {
      await onAction(status, notes)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pv3-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{REPORT_TYPE_LABELS[report.type]}</strong>
        <span style={{ fontSize: 11, color: '#9aa3b2' }}>{formatDate(report.created_at)}</span>
      </div>
      {report.site_label && (
        <p style={{ fontSize: 12, color: '#5f6373', margin: '0 0 6px' }}>
          Sitio: {report.site_label}
        </p>
      )}
      <p style={{ fontSize: 13, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{report.description}</p>
      {report.reported_by && (
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 4px' }}>
          Reportado por: {report.reported_by}
        </p>
      )}
      {report.contact_info && (
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 4px' }}>Contacto: {report.contact_info}</p>
      )}
      {source && (
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 8px' }}>Origen: {source}</p>
      )}
      <textarea
        className="pv3-input"
        style={{ minHeight: 56, marginBottom: 8 }}
        placeholder="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="pv3-btn pv3-btn--primary" disabled={busy} onClick={() => act('verified')}>
          Verificar
        </button>
        <button type="button" className="pv3-btn" disabled={busy} onClick={() => act('dismissed')}>
          Descartar
        </button>
      </div>
    </div>
  )
}

export function ReportInboxView() {
  const { data: reports, isLoading } = useCoordinatorPendingReports()
  const updateReport = useUpdateCoordinatorReport()

  if (isLoading) {
    return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando reportes…</p>
  }

  if (!reports?.length) {
    return (
      <p style={{ color: '#9aa3b2', fontSize: 13, textAlign: 'center', padding: 24 }}>
        No hay reportes pendientes para tu sitio
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {reports.map((r) => (
        <ReportRow
          key={r.id}
          report={r}
          onAction={(status, notes) => updateReport.mutateAsync({ id: r.id, status, review_notes: notes })}
        />
      ))}
    </div>
  )
}
