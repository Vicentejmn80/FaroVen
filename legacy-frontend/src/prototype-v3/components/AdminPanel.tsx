import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-provider'
import {
  useIsAdmin,
  useAdminReports,
  useUpdateReport,
  useAdminSupportRequests,
  useUpdateSupportRequest,
} from '@/hooks/useAdmin'
import {
  useAdminRegistry,
  useAdminDeleteSite,
  useAdminRemoveCoordinator,
  type AdminRegistryRow,
} from '@/hooks/useAdminSites'
import { formatDate } from '@/lib/utils'
import type { AdminReport, ReportStatus, SupportRequest, SupportRequestStatus } from '@/lib/types'
import { REPORT_SITE_TYPE_LABELS, REPORT_TYPE_LABELS, SUPPORT_REQUEST_STATUS_LABELS } from '@/lib/types'

type AdminTab = 'resumen' | 'reportes' | 'sitios' | 'apoyo'
type ReportFilter = 'all' | 'orphans'

interface AdminPanelProps {
  onBack: () => void
  onNeedAuth: () => void
}

export function AdminPanel({ onBack, onNeedAuth }: AdminPanelProps) {
  const { user, signOut } = useAuth()
  const { data: isAdmin, isLoading: checkingAdmin } = useIsAdmin()
  const [tab, setTab] = useState<AdminTab>('resumen')

  useEffect(() => {
    if (!user) onNeedAuth()
  }, [user, onNeedAuth])

  if (!user) return null

  if (!checkingAdmin && !isAdmin) {
    return (
      <div>
        <div className="pv3-view-header">
          <h2 className="pv3-view-title">Acceso restringido</h2>
          <button type="button" className="pv3-btn" onClick={onBack}>Volver</button>
        </div>
        <div className="pv3-card">
          <p style={{ fontSize: 13, color: '#5f6373', margin: 0 }}>
            Tu correo no está en la lista de administradores de FARO.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="pv3-view-header">
        <div>
          <h2 className="pv3-view-title">Administración</h2>
          <p style={{ fontSize: 12, color: '#9aa3b2', margin: '4px 0 0' }}>{user.email}</p>
        </div>
        <button type="button" className="pv3-btn" onClick={onBack}>Volver</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(
          [
            { id: 'resumen' as const, label: 'Resumen' },
            { id: 'reportes' as const, label: 'Reportes' },
            { id: 'sitios' as const, label: 'Sitios' },
            { id: 'apoyo' as const, label: 'Apoyo emocional' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pv3-btn ${tab === t.id ? 'pv3-btn--primary' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <AdminSummary onOpen={setTab} />}
      {tab === 'reportes' && <AdminReportsSection />}
      {tab === 'sitios' && <AdminSitesSection />}
      {tab === 'apoyo' && <AdminSupportSection />}

      <button
        type="button"
        className="pv3-btn"
        style={{ marginTop: 16, color: '#9aa3b2' }}
        onClick={() => signOut()}
      >
        Cerrar sesión
      </button>
    </div>
  )
}

function AdminSummary({ onOpen }: { onOpen: (t: AdminTab) => void }) {
  const { data: reports } = useAdminReports('pending')
  const { data: support } = useAdminSupportRequests('pending')
  const { data: registry } = useAdminRegistry()

  const pendingTotal = reports?.length ?? 0
  const orphanCount = reports?.filter((r) => !r.site_id).length ?? 0
  const orphanSites = registry?.filter((r) => r.is_orphan).length ?? 0

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button type="button" className="pv3-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpen('reportes')}>
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 4px' }}>Reportes pendientes (total)</p>
        <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{reports ? pendingTotal : '—'}</p>
      </button>
      <button type="button" className="pv3-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpen('reportes')}>
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 4px' }}>Sin sitio asignado (huérfanos)</p>
        <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: orphanCount > 0 ? '#7d1f1f' : undefined }}>
          {reports ? orphanCount : '—'}
        </p>
        {orphanCount > 0 && (
          <p style={{ fontSize: 11, color: '#9aa3b2', margin: '6px 0 0' }}>
            Requieren revisión de super-admin
          </p>
        )}
      </button>
      <button type="button" className="pv3-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpen('sitios')}>
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 4px' }}>Sitios sin coordinador</p>
        <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: orphanSites > 0 ? '#7d1f1f' : undefined }}>
          {registry ? orphanSites : '—'}
        </p>
        {orphanSites > 0 && (
          <p style={{ fontSize: 11, color: '#9aa3b2', margin: '6px 0 0' }}>
            Usuarios borrados pero sitios aún registrados
          </p>
        )}
      </button>
      <button type="button" className="pv3-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpen('apoyo')}>
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 4px' }}>Solicitudes de apoyo</p>
        <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{support?.length ?? '—'}</p>
      </button>
    </div>
  )
}

function AdminReportsSection() {
  const { data: reports, isLoading } = useAdminReports('pending')
  const updateReport = useUpdateReport()
  const [filter, setFilter] = useState<ReportFilter>('all')

  const filtered = reports?.filter((r) => (filter === 'orphans' ? !r.site_id : true))

  if (isLoading) return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando…</p>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className={`pv3-btn ${filter === 'all' ? 'pv3-btn--primary' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        <button
          type="button"
          className={`pv3-btn ${filter === 'orphans' ? 'pv3-btn--primary' : ''}`}
          onClick={() => setFilter('orphans')}
        >
          Sin sitio
        </button>
      </div>

      {!filtered?.length ? (
        <p style={{ color: '#9aa3b2', fontSize: 13, textAlign: 'center', padding: 24 }}>
          {filter === 'orphans' ? 'No hay reportes huérfanos pendientes.' : 'No hay reportes pendientes.'}
        </p>
      ) : (
        filtered.map((r) => (
          <ReportRow
            key={r.id}
            report={r}
            onAction={(status, notes) => updateReport.mutateAsync({ id: r.id, status, review_notes: notes })}
          />
        ))
      )}
    </div>
  )
}

function reportSiteBadge(report: AdminReport) {
  if (report.site_type && report.site_id && report.site_label) {
    return {
      linked: true,
      label: report.site_label,
      typeLabel: REPORT_SITE_TYPE_LABELS[report.site_type],
    }
  }
  if (report.other_place_name) {
    return {
      linked: false,
      label: report.other_place_name,
      typeLabel: null as string | null,
    }
  }
  return { linked: false, label: null, typeLabel: null }
}

function ReportRow({
  report,
  onAction,
}: {
  report: AdminReport
  onAction: (status: ReportStatus, notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (status: ReportStatus) => {
    setBusy(true)
    try {
      await onAction(status, notes)
    } finally {
      setBusy(false)
    }
  }

  const site = reportSiteBadge(report)

  return (
    <div className="pv3-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{REPORT_TYPE_LABELS[report.type]}</strong>
        <span style={{ fontSize: 11, color: '#9aa3b2' }}>{formatDate(report.created_at)}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {site.linked ? (
          <>
            <span className="pv3-report-site-badge pv3-report-site-badge--linked">{site.label}</span>
            {site.typeLabel && (
              <span className="pv3-report-site-badge pv3-report-site-badge--type">{site.typeLabel}</span>
            )}
          </>
        ) : site.label ? (
          <span className="pv3-report-site-badge pv3-report-site-badge--orphan">
            ⚠ {site.label} · sin vincular
          </span>
        ) : (
          <span className="pv3-report-site-badge pv3-report-site-badge--orphan">⚠ Sin sitio vinculado</span>
        )}
      </div>

      <p style={{ fontSize: 13, margin: '0 0 8px' }}>{report.description}</p>
      {report.reported_by && (
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 8px' }}>Reportado por: {report.reported_by}</p>
      )}
      {report.contact_info && (
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 8px' }}>Contacto: {report.contact_info}</p>
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

function AdminSitesSection() {
  const { data: rows, isLoading } = useAdminRegistry()
  const deleteSite = useAdminDeleteSite()
  const removeCoordinator = useAdminRemoveCoordinator()
  const [filter, setFilter] = useState<'all' | 'orphans'>('all')

  const filtered = rows?.filter((r) => (filter === 'orphans' ? r.is_orphan : true))

  if (isLoading) return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando…</p>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="pv3-note" style={{ margin: 0 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
          Si borras un usuario en Authentication, su hospital o acopio <strong>no se elimina solo</strong>.
          Usa <strong>Eliminar sitio</strong> para quitar el lugar completo, o <strong>Quitar coordinador</strong> si
          quieres conservar el sitio y asignarlo a otra persona.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className={`pv3-btn ${filter === 'all' ? 'pv3-btn--primary' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos ({rows?.length ?? 0})
        </button>
        <button
          type="button"
          className={`pv3-btn ${filter === 'orphans' ? 'pv3-btn--primary' : ''}`}
          onClick={() => setFilter('orphans')}
        >
          Sin coordinador ({rows?.filter((r) => r.is_orphan).length ?? 0})
        </button>
      </div>

      {!filtered?.length ? (
        <p style={{ color: '#9aa3b2', fontSize: 13, textAlign: 'center', padding: 24 }}>
          {filter === 'orphans' ? 'No hay sitios huérfanos.' : 'No hay sitios registrados.'}
        </p>
      ) : (
        filtered.map((row) => (
          <SiteRegistryRow
            key={`${row.site_type}-${row.site_id}`}
            row={row}
            busy={deleteSite.isPending || removeCoordinator.isPending}
            onDeleteSite={() => deleteSite.mutateAsync({ siteType: row.site_type, siteId: row.site_id })}
            onRemoveCoordinator={() => row.profile_id && removeCoordinator.mutateAsync(row.profile_id)}
          />
        ))
      )}
    </div>
  )
}

function SiteRegistryRow({
  row,
  busy,
  onDeleteSite,
  onRemoveCoordinator,
}: {
  row: AdminRegistryRow
  busy: boolean
  onDeleteSite: () => Promise<void>
  onRemoveCoordinator: () => Promise<void>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const typeLabel = REPORT_SITE_TYPE_LABELS[row.site_type]

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await onDeleteSite()
    setConfirmDelete(false)
  }

  return (
    <div className="pv3-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <strong style={{ fontSize: 14 }}>{row.site_name}</strong>
          <span className="pv3-report-site-badge pv3-report-site-badge--type" style={{ marginLeft: 8 }}>
            {typeLabel}
          </span>
        </div>
        {row.is_orphan ? (
          <span className="pv3-report-site-badge pv3-report-site-badge--orphan">Sin coordinador</span>
        ) : (
          <span className="pv3-report-site-badge pv3-report-site-badge--linked">Con coordinador</span>
        )}
      </div>

      {row.site_address && (
        <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 8px' }}>{row.site_address}</p>
      )}

      {!row.is_orphan && (
        <p style={{ fontSize: 13, margin: '0 0 10px', color: '#5f6373' }}>
          {row.coordinator_name ?? 'Coordinador'} · {row.coordinator_email ?? row.auth_user_id}
        </p>
      )}

      <p style={{ fontSize: 11, color: '#9aa3b2', margin: '0 0 10px', fontFamily: 'monospace' }}>
        ID: {row.site_id}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {!row.is_orphan && row.profile_id && (
          <button type="button" className="pv3-btn" disabled={busy} onClick={() => onRemoveCoordinator()}>
            Quitar coordinador
          </button>
        )}
        <button
          type="button"
          className={`pv3-btn ${confirmDelete ? 'pv3-btn--primary' : ''}`}
          disabled={busy}
          style={confirmDelete ? { background: '#dc2626', borderColor: '#dc2626' } : undefined}
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
        >
          {confirmDelete ? 'Confirmar eliminar sitio' : 'Eliminar sitio'}
        </button>
        {confirmDelete && (
          <button type="button" className="pv3-btn" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

function AdminSupportSection() {
  const { data: requests, isLoading } = useAdminSupportRequests('pending')
  const updateRequest = useUpdateSupportRequest()

  if (isLoading) return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando…</p>
  if (!requests?.length) {
    return <p style={{ color: '#9aa3b2', fontSize: 13, textAlign: 'center', padding: 24 }}>No hay solicitudes pendientes.</p>
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {requests.map((r) => (
        <SupportRow
          key={r.id}
          req={r}
          onAction={(status, assigned, notes) =>
            updateRequest.mutateAsync({ id: r.id, status, assigned_to: assigned, review_notes: notes })
          }
        />
      ))}
    </div>
  )
}

function SupportRow({
  req,
  onAction,
}: {
  req: SupportRequest
  onAction: (status: SupportRequestStatus, assigned: string, notes: string) => Promise<void>
}) {
  const [assigned, setAssigned] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (status: SupportRequestStatus) => {
    setBusy(true)
    try {
      await onAction(status, assigned, notes)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pv3-card" style={req.urgent ? { borderColor: '#f2b4b4' } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>
          {req.for_whom} {req.urgent ? '· URGENTE' : ''}
        </strong>
        <span style={{ fontSize: 11, color: '#9aa3b2' }}>{SUPPORT_REQUEST_STATUS_LABELS[req.status]}</span>
      </div>
      {req.topic && <p style={{ fontSize: 13, margin: '0 0 6px' }}>Tema: {req.topic}</p>}
      {req.description && <p style={{ fontSize: 13, color: '#5f6373', margin: '0 0 8px' }}>{req.description}</p>}
      {req.contact_value && (
        <p style={{ fontSize: 12, margin: '0 0 8px' }}>
          Contacto ({req.contact_method}): {req.contact_value}
        </p>
      )}
      <input
        className="pv3-input"
        style={{ marginBottom: 8 }}
        placeholder="Asignar a (psicólogo/a)"
        value={assigned}
        onChange={(e) => setAssigned(e.target.value)}
      />
      <textarea
        className="pv3-input"
        style={{ minHeight: 56, marginBottom: 8 }}
        placeholder="Notas internas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="pv3-btn pv3-btn--primary" disabled={busy || !assigned.trim()} onClick={() => act('assigned')}>
          Asignar
        </button>
        <button type="button" className="pv3-btn" disabled={busy} onClick={() => act('contacted')}>
          Contactado
        </button>
        <button type="button" className="pv3-btn" disabled={busy} onClick={() => act('closed')}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
