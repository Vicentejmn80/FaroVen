import { useState, useMemo } from 'react'
import { useReports } from '@/hooks/useReports'
import { useMissions } from '@/hooks/useMissions'
import { useCases } from '@/hooks/useCases'
import { useRoleRequests } from '@/hooks/useRoleRequests'
import { GlassCard } from '@/components/ui/glass-card'
import { ReportDetailPanel } from '@/components/case-manager/report-detail-panel'
import { ConvertReportWizard } from '@/components/case-manager/convert-report-wizard'
import { RoleRequestAdminPanel } from '@/components/role-request/role-request-admin-panel'
import { cn } from '@/lib/utils'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'

type ManagerTab = 'inbox' | 'cases' | 'missions' | 'solicitudes'

export function CaseManagerWorkspace() {
  const [tab, setTab] = useState<ManagerTab>('inbox')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState<string | null>(null)

  useRealtimeSync({
    channelName: 'cm-reports',
    tables: ['reports', 'cases', 'case_events'],
    invalidateKeys: [FARO_QUERY_KEYS.reports, FARO_QUERY_KEYS.cases],
  })

  const { data: reports, isLoading: reportsLoading } = useReports()
  const { data: allCases, isLoading: casesLoading } = useCases()
  const { data: missions } = useMissions()
  const { data: requests } = useRoleRequests()

  const pendingRequests = useMemo(() => requests?.filter((r) => r.status === 'pending' || r.status === 'under_review') ?? [], [requests])
  const pendingReports = useMemo(() => reports?.filter((r) => r.status === 'new') ?? [], [reports])
  const activeCases = useMemo(() => allCases?.filter((c) => c.pipelineStage !== 'archived') ?? [], [allCases])

  const tabs: Array<{ id: ManagerTab; label: string; badge?: number }> = [
    { id: 'inbox', label: 'Bandeja', badge: pendingReports.length },
    { id: 'cases', label: 'Casos', badge: activeCases.length },
    { id: 'missions', label: 'Misiones' },
    { id: 'solicitudes', label: 'Solicitudes', badge: pendingRequests.length },
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pt-safe pb-3 lg:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="text-lg font-semibold text-ink">Centro de Operaciones</h1>
        </div>
      </header>

      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedReportId(null); setShowWizard(null) }}
              className={cn('shrink-0 relative rounded-full px-3 py-1.5 text-xs font-medium transition-colors', tab === t.id ? 'border-info/50 bg-info/15 text-ink' : 'border border-white/10 text-ink-subtle hover:bg-white/[0.04]')}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-critical text-[9px] font-bold text-white">{t.badge > 9 ? '9+' : t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'inbox' && (
          <div className="flex h-full">
            <div className={cn('flex-1 overflow-y-auto px-4 pb-32 space-y-3', selectedReportId ? 'hidden lg:block' : '')}>
              <h2 className="text-sm font-semibold text-ink pt-2">Reportes entrantes</h2>
              {reportsLoading ? (
                [1, 2, 3].map((i) => <GlassCard key={i} className="h-20 animate-pulse" />)
              ) : pendingReports.length === 0 ? (
                <GlassCard className="p-4 text-center text-sm text-ink-subtle">No hay reportes pendientes</GlassCard>
              ) : (
                pendingReports.map((report) => (
                  <GlassCard key={report.id} className={cn('p-3 cursor-pointer transition-all hover:bg-white/[0.06]', selectedReportId === report.id ? 'ring-1 ring-info/40' : '')} onClick={() => setSelectedReportId(report.id)}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-ink line-clamp-1">{report.description}</p>
                      <span className="shrink-0 text-xs text-ink-muted">{report.createdAt.toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-subtle">
                      <span>{report.location.zone}</span>
                      <span>&middot;</span>
                      <span>{report.source}</span>
                    </div>
                  </GlassCard>
                ))
              )}
            </div>
            {selectedReportId && (
              <div className="w-full lg:w-96 border-l border-white/[0.06]">
                {showWizard === selectedReportId ? (
                  <ConvertReportWizard
                    reportId={selectedReportId}
                    onDone={() => { setShowWizard(null); setSelectedReportId(null) }}
                    onCancel={() => setShowWizard(null)}
                  />
                ) : (
                  <ReportDetailPanel
                    reportId={selectedReportId}
                    onClose={() => setSelectedReportId(null)}
                    onConvertToCase={(id) => setShowWizard(id)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'cases' && (
          <div className="px-4 pb-32 space-y-3">
            <h2 className="text-sm font-semibold text-ink pt-2">Casos activos</h2>
            {casesLoading ? (
              [1, 2].map((i) => <GlassCard key={i} className="h-20 animate-pulse" />)
            ) : activeCases.length === 0 ? (
              <GlassCard className="p-4 text-center text-sm text-ink-subtle">No hay casos activos</GlassCard>
            ) : (
              activeCases.map((c) => (
                <GlassCard key={c.id} className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-ink">{c.title}</p>
                    <span className={cn('shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', c.priority === 'critical' ? 'bg-critical/20 text-critical' : c.priority === 'high' ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info')}>
                      {c.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-subtle">
                    <span>{c.zone}</span>
                    <span>&middot;</span>
                    <span>Etapa: {c.pipelineStage}</span>
                    {c.slaDeadline && <span>&middot;</span>}
                    {c.slaDeadline && <span className={cn(c.slaDeadline < new Date() ? 'text-critical' : '')}>SLA: {c.slaDeadline.toLocaleDateString()}</span>}
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        )}

        {tab === 'missions' && (
          <div className="px-4 pb-32 space-y-3">
            <h2 className="text-sm font-semibold text-ink pt-2">Misiones activas</h2>
            {!missions || missions.length === 0 ? (
              <GlassCard className="p-4 text-center text-sm text-ink-subtle">No hay misiones activas</GlassCard>
            ) : (
              missions.map((m) => (
                <GlassCard key={m.id} className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-ink">{m.title}</p>
                    <span className="text-xs text-ink-muted">{m.status}</span>
                  </div>
                  <p className="text-xs text-ink-subtle line-clamp-1">{m.description}</p>
                </GlassCard>
              ))
            )}
          </div>
        )}

        {tab === 'solicitudes' && (
          <div className="px-4 pb-32">
            <h2 className="text-sm font-semibold text-ink pt-2 mb-3">Solicitudes de rol</h2>
            <RoleRequestAdminPanel />
          </div>
        )}
      </div>
    </div>
  )
}
