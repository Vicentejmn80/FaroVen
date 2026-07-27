import { useState, useMemo, useCallback } from 'react'
import { useReports, useDeleteReport } from '@/hooks/useReports'
import { useMissions } from '@/hooks/useMissions'
import { useCases, useArchiveCase } from '@/hooks/useCases'
import { useConfirmCenterAssignment, useRejectCenterAssignment } from '@/hooks/useCaseMutations'
import { useRoleRequests } from '@/hooks/useRoleRequests'
import { useVolunteerInterests } from '@/hooks/useVolunteerInterests'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { ReportDetailPanel } from '@/components/case-manager/report-detail-panel'
import { ConvertReportWizard } from '@/components/case-manager/convert-report-wizard'
import { EsperarPostulanteModal } from '@/components/case-manager/esperar-postulante-modal'
import { AsignarCentroModal } from '@/components/case-manager/asignar-centro-modal'
import { RoleRequestAdminPanel } from '@/components/role-request/role-request-admin-panel'
import { AvailabilityCalendarCard } from '@/components/availability/availability-calendar-card'
import { PostulationPanel } from '@/components/dispatch/postulation-panel'
import { LiveTrackingCard } from '@/components/dispatch/live-tracking-card'
import { OperationalTimeline, type TimelineStep } from '@/components/dispatch/operational-timeline'
import { cn, isValidCoord } from '@/lib/utils'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { label, PRIORITY_LABELS, INTEREST_STATUS_LABELS, OP_LABELS, PIPELINE_LABELS, MISSION_STAGE_LABELS, NEED_STATUS_LABELS, PUBLIC_NEED_STATUS_LABELS, COVERAGE_RESERVATION_LABELS, SKILL_LABELS, COLLABORATOR_TYPE_LABELS, MISSION_EVENT_LABELS } from '@/lib/labels'
import { useAuth, usePermissions } from '@/store/auth-context'
import { useApproveNeedInterest, useCloseNeedCall, useNeedInterests, useOpenNeedCall, useOperationalPublicNeeds, useRejectNeedInterest, useVerifyPublicNeedEntry } from '@/hooks/usePublicNeeds'
import { useCaseApplications, useApproveCaseApplication, useRejectCaseApplication } from '@/hooks/useCaseApplications'
import { useMissionTimeline, useMissionAssignments } from '@/hooks/useMissions'
import type { Mission } from '@/domain/mission.types'
import { useVerifyAssignment } from '@/hooks/useMissionMutations'
import { SuccessCasesPanel } from '@/components/shared/success-cases-panel'
import { isActiveStage } from '@/domain/case-lifecycle.service'
import { VOLUNTEER_AVAILABILITY_LABELS } from '@/domain/volunteer.types'

type ManagerTab = 'inbox' | 'public-needs' | 'cases' | 'missions' | 'success' | 'solicitudes'

function InterestsPanel() {
  const { data: interests, isLoading } = useVolunteerInterests()
  const pending = useMemo(() => interests?.filter((i) => i.status === 'pending') ?? [], [interests])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <GlassCard key={i} className="h-14 animate-pulse" />)}
      </div>
    )
  }

  if (pending.length === 0) {
    return <GlassCard className="p-4 text-center text-sm text-ink-subtle">{OP_LABELS.noData}</GlassCard>
  }

  return (
    <div className="space-y-2">
      {pending.map((interest) => (
        <GlassCard key={interest.volunteerId} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink">{interest.volunteerName}</p>
              <p className="text-xs text-ink-subtle mt-0.5">{interest.message ?? 'Quiere ayudar'}</p>
              <span className="mt-1 inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning">
                {label(INTEREST_STATUS_LABELS, interest.status)}
              </span>
            </div>
            <div className="flex gap-1.5">
              <EmergencyButton variant="glass" size="sm">Contactar</EmergencyButton>
              <EmergencyButton variant="glass" size="sm" className="text-operational">Aceptar</EmergencyButton>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

function NeedInterestsPanel({
  publicNeedId,
  operatorId,
}: {
  publicNeedId: string
  operatorId?: string
}) {
  const { data: interests = [], isLoading } = useNeedInterests(publicNeedId)
  const approveInterest = useApproveNeedInterest()
  const rejectInterest = useRejectNeedInterest()
  const { isCaseManager, isCoordinator, isRegionalAdmin, isSuperAdmin } = usePermissions()
  const canModerate = isCaseManager || isCoordinator || isRegionalAdmin || isSuperAdmin

  const pending = useMemo(() => interests.filter((interest) => interest.status === 'reserved'), [interests])
  const history = useMemo(() => interests.filter((interest) => interest.status !== 'reserved'), [interests])

  if (isLoading) {
    return <GlassCard className="h-16 animate-pulse" />
  }

  if (interests.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        Sin interesados todavía.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {pending.map((interest) => (
        <div key={interest.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-ink">
                {interest.collaboratorName ?? 'Colaborador FARO'}
              </p>
              <p className="text-[11px] text-ink-subtle">
                {label(COLLABORATOR_TYPE_LABELS, interest.collaboratorType)} · {label(COVERAGE_RESERVATION_LABELS, interest.status)}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-ink-faint">
                {interest.distanceKm != null && <span>{interest.distanceKm.toFixed(1)} km</span>}
                {interest.volunteerAvailability && (
                  <span>{label(VOLUNTEER_AVAILABILITY_LABELS, interest.volunteerAvailability, interest.volunteerAvailability)}</span>
                )}
                {interest.volunteerExperience && <span>{interest.volunteerExperience}</span>}
                {interest.volunteerAvgResponseMinutes != null && <span>Resp. {interest.volunteerAvgResponseMinutes} min</span>}
                {interest.volunteerCompletedMissions != null && <span>{interest.volunteerCompletedMissions} misiones</span>}
              </div>
            </div>
            {canModerate && (
              <div className="flex gap-1.5">
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  disabled={!operatorId || approveInterest.isPending}
                  onClick={() => {
                    if (!operatorId) return
                    approveInterest.mutate({ reservationId: interest.id, operatorId })
                  }}
                >
                  Aprobar
                </EmergencyButton>
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  disabled={!operatorId || rejectInterest.isPending}
                  onClick={() => {
                    if (!operatorId) return
                    rejectInterest.mutate({ reservationId: interest.id, operatorId })
                  }}
                >
                  Rechazar
                </EmergencyButton>
              </div>
            )}
          </div>
        </div>
      ))}

      {history.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Historial de decisiones</p>
          {history.map((interest) => (
            <p key={interest.id} className="text-[11px] text-ink-muted">
              {interest.collaboratorName ?? 'Colaborador'} · {label(COVERAGE_RESERVATION_LABELS, interest.status, interest.status)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function MissionDetailCard({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const { user } = useAuth()
  const { data: missionEvents } = useMissionTimeline(mission.id)
  const { data: assignments } = useMissionAssignments(mission.id)
  const verifyAssignment = useVerifyAssignment()

  // Validar aunque no haya evidencias: el voluntario puede finalizar sin adjuntos.
  const pendingValidation = useMemo(() => {
    if (!assignments) return []
    return assignments.filter((a) => a.status === 'completed')
  }, [assignments])

  const timelineSteps: TimelineStep[] = [
    { id: 'created', label: 'Misión creada', timestamp: new Date(mission.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }), completed: true, active: false },
    { id: 'assigned', label: 'Voluntarios asignados', completed: ['assigned', 'accepted', 'en_route', 'on_site', 'in_progress', 'completed', 'verified'].includes(mission.status), active: mission.status === 'assigned' },
    { id: 'accepted', label: 'Voluntarios en camino', completed: ['accepted', 'en_route', 'on_site', 'in_progress', 'completed', 'verified'].includes(mission.status), active: mission.status === 'accepted' },
    { id: 'en_route', label: 'En ruta al sitio', completed: ['en_route', 'on_site', 'in_progress', 'completed', 'verified'].includes(mission.status), active: mission.status === 'en_route' },
    { id: 'on_site', label: 'En el sitio', completed: ['on_site', 'in_progress', 'completed', 'verified'].includes(mission.status), active: mission.status === 'on_site' },
    { id: 'in_progress', label: 'Asistencia en progreso', completed: ['in_progress', 'completed', 'verified'].includes(mission.status), active: mission.status === 'in_progress' },
    { id: 'completed', label: 'Misión completada', completed: ['completed', 'verified'].includes(mission.status), active: mission.status === 'completed' },
    { id: 'verified', label: 'Verificada', completed: mission.status === 'verified', active: mission.status === 'verified' },
  ]

  return (
    <div className="space-y-3 px-2 pb-4">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="text-xs text-info underline">Volver a lista</button>
      </div>

      {mission.status !== 'cancelled' && mission.status !== 'archived' && (
        <PostulationPanel missionId={mission.id} />
      )}

      <div className="bg-white/[0.03] rounded-2xl p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-3">Progreso de la misión</p>
        <OperationalTimeline steps={timelineSteps} />
      </div>

      {missionEvents && missionEvents.length > 0 && (
        <div className="bg-white/[0.03] rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-3">Registro de eventos</p>
          <div className="space-y-1.5">
            {missionEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-info shrink-0" />
                <span className="text-ink-subtle">{label(MISSION_EVENT_LABELS, ev.eventType)}</span>
                {ev.description && <span className="text-ink-faint">&middot; {ev.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingValidation.length > 0 && (
        <div className="bg-warning/[0.06] rounded-2xl border border-warning/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning mb-3">
            Esperando validación de entrega
          </p>
          <div className="space-y-3">
            {pendingValidation.map((a) => (
              <div key={a.id} className="space-y-2">
                <p className="text-[11px] text-ink-muted">
                  {a.evidenceUrls && a.evidenceUrls.length > 0
                    ? 'El voluntario marcó Entregado y adjuntó evidencia'
                    : 'El voluntario marcó Entregado — revisa y confirma para cerrar'}
                </p>
                {a.evidenceUrls && a.evidenceUrls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {a.evidenceUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-info underline truncate max-w-[200px]"
                      >
                        Ver evidencia {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  disabled={!user?.id || verifyAssignment.isPending}
                  onClick={() => {
                    if (!user?.id) return
                    verifyAssignment.mutate({ assignmentId: a.id, verifiedBy: user.id })
                  }}
                >
                  Confirmar entrega
                </EmergencyButton>
              </div>
            ))}
          </div>
        </div>
      )}

      <LiveTrackingCard
        missionLat={mission.location.lat}
        missionLng={mission.location.lng}
        missionAddress={mission.location.zone ?? `${mission.location.lat.toFixed(4)}, ${mission.location.lng.toFixed(4)}`}
        volunteerUserId={undefined}
      />
    </div>
  )
}

export function CaseManagerWorkspace() {
  const [tab, setTab] = useState<ManagerTab>('inbox')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null)
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const [convertingReportId, setConvertingReportId] = useState<string | null>(null)
  const { user } = useAuth()
  const { data: publicNeeds = [], isLoading: publicNeedsLoading } = useOperationalPublicNeeds()
  const verifyPublicNeed = useVerifyPublicNeedEntry()
  const openNeedCall = useOpenNeedCall()
  const closeNeedCall = useCloseNeedCall()
  const deleteReport = useDeleteReport()
  const archiveCase = useArchiveCase()
  const confirmCenter = useConfirmCenterAssignment()
  const rejectCenter = useRejectCenterAssignment()
  const [esperandoCasoId, setEsperandoCasoId] = useState<string | null>(null)
  const [asignandoCasoId, setAsignandoCasoId] = useState<string | null>(null)
  const [applicationCaseId, setApplicationCaseId] = useState<string | undefined>(undefined)
  const { data: applications = [] } = useCaseApplications(applicationCaseId)
  const approveApp = useApproveCaseApplication()
  const rejectApp = useRejectCaseApplication()

  useRealtimeSync({
    channelName: 'cm-reports',
    tables: [
      'reports',
      'cases',
      'case_events',
      'case_applications',
      'missions',
      'mission_applications',
      'mission_assignments',
      'public_needs',
      'coverage_reservations',
      'success_cases',
    ],
    invalidateKeys: [
      FARO_QUERY_KEYS.reports,
      FARO_QUERY_KEYS.cases,
      FARO_QUERY_KEYS.caseEvents,
      FARO_QUERY_KEYS.caseApplications,
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.missionApplications,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.publicNeeds,
      FARO_QUERY_KEYS.coverage,
      FARO_QUERY_KEYS.successCases,
    ],
  })

  const { data: reports, isLoading: reportsLoading } = useReports()
  const { data: allCases, isLoading: casesLoading } = useCases()
  const { data: missions } = useMissions()
  const { data: requests } = useRoleRequests()

  const pendingRequests = useMemo(() => requests?.filter((r) => r.status === 'pending' || r.status === 'under_review') ?? [], [requests])
  const pendingReports = useMemo(
    () => reports?.filter((r) => r.status === 'new' || r.status === 'reviewing') ?? [],
    [reports],
  )
  const activeCases = useMemo(
    () => allCases?.filter((c) => isActiveStage(c.pipelineStage)) ?? [],
    [allCases],
  )
  const openPublicNeeds = useMemo(
    () =>
      publicNeeds.filter(
        (n) =>
          n.callStatus === 'open' &&
          n.visibilityStatus === 'public' &&
          n.status !== 'completed' &&
          n.status !== 'archived',
      ),
    [publicNeeds],
  )
  const activeMissions = useMemo(
    () =>
      missions?.filter(
        (m) => !['completed', 'verified', 'archived', 'cancelled'].includes(m.status),
      ) ?? [],
    [missions],
  )
  const pendingPublicNeeds = useMemo(
    () => publicNeeds.filter((n) => n.verificationStatus === 'pending_entry' || n.status === 'pending'),
    [publicNeeds],
  )
  const draftPublicNeeds = useMemo(
    () =>
      publicNeeds.filter(
        (n) =>
          n.callStatus !== 'open' &&
          n.callStatus !== 'complete' &&
          n.status !== 'completed' &&
          n.status !== 'archived',
      ),
    [publicNeeds],
  )

  const manageablePublicNeeds = useMemo(
    () => [...draftPublicNeeds, ...openPublicNeeds],
    [draftPublicNeeds, openPublicNeeds],
  )

  const selectReport = useCallback((id: string) => {
    setSelectedReportId((prev) => prev === id ? null : id)
  }, [])

  const tabs: Array<{ id: ManagerTab; label: string; badge?: number }> = [
    { id: 'inbox', label: 'Bandeja', badge: pendingReports.length },
    { id: 'public-needs', label: 'Necesidades', badge: pendingPublicNeeds.length },
    { id: 'cases', label: 'Casos', badge: activeCases.length },
    { id: 'missions', label: 'Misiones', badge: activeMissions.length },
    { id: 'success', label: 'Casos de éxito' },
    { id: 'solicitudes', label: 'Solicitudes', badge: pendingRequests.length },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 pt-safe pb-3 lg:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="text-lg font-semibold text-ink">Centro de Operaciones</h1>
        </div>
      </header>

      <div className="shrink-0 px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedReportId(null) }}
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

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'inbox' && (
          <div className="flex h-full">
            <div className={cn('flex flex-col overflow-y-auto', selectedReportId ? 'hidden lg:flex lg:w-72 xl:w-80' : 'flex-1')}>
              <div className="shrink-0 px-4 pt-1 pb-3">
                <AvailabilityCalendarCard />
              </div>
              <div className="px-4 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Reportes entrantes
                  {pendingReports.length > 0 && <span className="ml-1 text-critical">({pendingReports.length})</span>}
                </p>
              </div>
              {reportsLoading ? (
                <div className="space-y-2 px-4">
                  {[1, 2, 3].map((i) => <GlassCard key={i} className="h-16 animate-pulse" />)}
                </div>
              ) : pendingReports.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-4">
                  <p className="text-sm text-ink-subtle">No hay reportes entrantes</p>
                </div>
              ) : (
                <div className="space-y-1 px-2">
                  {pendingReports.map((report) => (
                    <div key={report.id} className="group flex items-start gap-1">
                      <button onClick={() => selectReport(report.id)}
                        className={cn('flex-1 rounded-2xl p-3 text-left transition-all hover:bg-white/[0.04]', selectedReportId === report.id ? 'bg-info/10 ring-1 ring-info/30' : '')}>
                        <p className="text-sm font-medium text-ink line-clamp-1 leading-snug">{report.description}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-subtle">
                          <span>{report.location?.zone ?? '—'}</span>
                          <span>&middot;</span>
                          <span>{new Date(report.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>&middot;</span>
                          <span className={cn(
                            isValidCoord(report.location?.coordinates?.lat ?? 0, report.location?.coordinates?.lng ?? 0)
                              ? 'text-operational'
                              : 'text-warning',
                          )}>
                            {isValidCoord(report.location?.coordinates?.lat ?? 0, report.location?.coordinates?.lng ?? 0)
                              ? 'GPS'
                              : 'Sin GPS'}
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('¿Eliminar este reporte? No se podrá recuperar.')) {
                            deleteReport.mutate(report.id)
                          }
                        }}
                        disabled={deleteReport.isPending}
                        className="mt-2.5 mr-1 shrink-0 rounded-full p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-critical/15 hover:text-critical group-hover:opacity-100"
                        title="Eliminar reporte"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>                  ))}
                </div>
              )}
            </div>
            {selectedReportId ? (
              <div className="flex-1 border-l border-white/[0.06]">
                {convertingReportId === selectedReportId ? (
                  <div className="overflow-y-auto p-4">
                    <ConvertReportWizard
                      reportId={selectedReportId}
                      onDone={() => { setConvertingReportId(null); setSelectedReportId(null) }}
                      onCancel={() => setConvertingReportId(null)}
                    />
                  </div>
                ) : (
                  <ReportDetailPanel
                    reportId={selectedReportId}
                    onClose={() => setSelectedReportId(null)}
                    onConvertToCase={() => setConvertingReportId(selectedReportId)}
                  />
                )}
              </div>
            ) : (
              <div className="hidden flex-1 items-center justify-center border-l border-white/[0.06] lg:flex">
                <div className="text-center">
                  <p className="text-sm text-ink-subtle">Selecciona un reporte para comenzar</p>
                  <p className="mt-1 text-xs text-ink-faint">El panel de despacho aparecerá aquí</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'cases' && (
          <div className="h-full overflow-y-auto px-4 pb-nav space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle pt-2">Casos activos</p>
            {casesLoading ? (
              [1, 2].map((i) => <GlassCard key={i} className="h-20 animate-pulse" />)
            ) : activeCases.length === 0 ? (
              <GlassCard className="p-4 text-center text-sm text-ink-subtle">No hay casos activos</GlassCard>
            ) : (
              activeCases.map((c) => {
                const isExpanded = expandedCaseId === c.id
                return (
                <div key={c.id}>
                  <button onClick={() => setExpandedCaseId(isExpanded ? null : c.id)} className="w-full text-left">
                    <GlassCard className={cn('p-3 transition-all', isExpanded ? 'ring-1 ring-info/30' : '')}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-ink line-clamp-2">{c.title}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', c.priority === 'critical' ? 'bg-critical/20 text-critical' : c.priority === 'high' ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info')}>
                            {label(PRIORITY_LABELS, c.priority, c.priority)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Archivar el caso "${c.title}"? Se moverá a casos archivados.`)) { archiveCase.mutate({ caseId: c.id, actorId: user?.id, comment: 'Archivado por gestor de casos' }) } }}
                            disabled={archiveCase.isPending}
                            className="rounded-full p-1 text-ink-faint hover:bg-critical/15 hover:text-critical"
                            title="Archivar caso"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                        <span>{label(PIPELINE_LABELS, c.pipelineStage)}</span>
                        <span>&middot;</span>
                        <span>{Math.max(0, Math.round((Date.now() - c.createdAt.getTime()) / 3600000))}h</span>
                        <span>&middot;</span>
                        <span>
                          {c.assignedTo ??
                            (c.assignedCenterId ? `Centro ${c.assignedCenterId.slice(0, 6)}` : 'Sin responsable')}
                        </span>
                      </div>
                    </GlassCard>
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 px-1 pt-2 pb-3">
                      <p className="text-xs text-ink-muted line-clamp-2">{c.description}</p>

                      {/* Caso en revisión: SOLO dos acciones */}
                      {(c.pipelineStage === 'pending_review' ||
                        c.pipelineStage === 'validating' ||
                        c.pipelineStage === 'awaiting_info') && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEsperandoCasoId(c.id)}
                            className={cn(
                              'flex-1 rounded-xl border px-3 py-2 text-left text-xs transition-all hover:bg-white/[0.04]',
                              'border-white/[0.08]',
                            )}
                          >
                            <p className="font-medium text-ink">Solicitar postulantes</p>
                            <p className="text-ink-faint mt-0.5">
                              Abre el radar y notifica a voluntarios — no asigna a nadie
                            </p>
                          </button>
                          <button
                            onClick={() => setAsignandoCasoId(c.id)}
                            className={cn(
                              'flex-1 rounded-xl border px-3 py-2 text-left text-xs transition-all hover:bg-white/[0.04]',
                              'border-white/[0.08]',
                            )}
                          >
                            <p className="font-medium text-ink">Asignar a Centro</p>
                            <p className="text-ink-faint mt-0.5">
                              Centro, refugio, ONG o institución — espera confirmación
                            </p>
                          </button>
                        </div>
                      )}

                      {c.pipelineStage === 'awaiting_center_confirmation' && (
                        <div className="space-y-2 rounded-xl border border-warning/20 bg-warning/[0.06] p-3">
                          <p className="text-xs font-medium text-warning">
                            Esperando confirmación del centro
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            El caso aún no está ASIGNADO. Confirma cuando el centro acepte, o
                            devuélvelo a revisión.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                confirmCenter.mutate({ caseId: c.id, actorId: user?.id })
                              }
                              disabled={confirmCenter.isPending || !user?.id}
                              className="flex-1 rounded-lg bg-operational/15 py-1.5 text-xs font-medium text-operational hover:bg-operational/25"
                            >
                              Centro confirmó
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                rejectCenter.mutate({
                                  caseId: c.id,
                                  actorId: user?.id,
                                  reason: 'Sin respuesta del centro',
                                })
                              }
                              disabled={rejectCenter.isPending || !user?.id}
                              className="flex-1 rounded-lg bg-white/[0.06] py-1.5 text-xs font-medium text-ink-subtle hover:bg-white/[0.1]"
                            >
                              Sin respuesta
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Postulaciones: solo contador + ver */}
                      {c.pipelineStage === 'open_for_applications' && (
                        <div className="space-y-2">
                          <button
                            onClick={() =>
                              setApplicationCaseId(applicationCaseId === c.id ? undefined : c.id)
                            }
                            className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-left text-xs transition-all hover:bg-white/[0.04]"
                          >
                            <p className="font-medium text-ink">
                              Ver postulantes
                              {applicationCaseId === c.id || applications.length > 0
                                ? ` (${applicationCaseId === c.id ? applications.length : '…'})`
                                : ''}
                            </p>
                            <p className="text-ink-faint mt-0.5">
                              Al aceptar, el caso pasa a ASIGNADO
                            </p>
                          </button>

                          {applicationCaseId === c.id && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Postulaciones</p>
                                <button
                                  onClick={() => setApplicationCaseId(undefined)}
                                  className="text-xs text-ink-faint hover:text-ink"
                                >
                                  Cerrar
                                </button>
                              </div>

                              {applications.length === 0 ? (
                                <p className="text-xs text-ink-faint text-center py-4">Aún no hay postulaciones. Comparte el caso para que voluntarios y ONGs puedan postularse.</p>
                              ) : (
                                applications.map((app) => {
                                  const canModerate = app.status === 'pending' || app.status === 'under_review'
                                  return (
                                    <div key={app.id} className="rounded-xl border border-white/[0.08] p-3 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-ink">{app.applicantName}</p>
                                          {app.organization && <p className="text-xs text-ink-subtle">{app.organization}</p>}
                                          {app.trustScore !== undefined && (
                                            <p className="text-[10px] text-ink-faint mt-0.5">Confianza: {app.trustScore}%</p>
                                          )}
                                        </div>
                                        <span className={cn('shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', app.status === 'pending' ? 'bg-warning/15 text-warning' : app.status === 'approved' ? 'bg-operational/15 text-operational' : app.status === 'rejected' ? 'bg-critical/15 text-critical' : 'bg-white/[0.06] text-ink-muted')}>
                                          {label({ pending: 'Pendiente', under_review: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado', withdrawn: 'Retirado', expired: 'Expirado' }, app.status)}
                                        </span>
                                      </div>
                                      {app.message && <p className="text-xs text-ink-muted">{app.message}</p>}
                                      <div className="flex flex-wrap gap-1.5">
                                        {app.skills?.map((s) => (
                                          <span key={s} className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-faint">{label(SKILL_LABELS, s, s)}</span>
                                        ))}
                                      </div>
                                      {app.totalMissions !== undefined && (
                                        <div className="flex gap-3 text-[10px] text-ink-faint">
                                          <span>Reputación: {app.trustScore ?? '—'}%</span>
                                          <span>{app.completedMissions ?? 0} misiones ok</span>
                                          {app.avgResponseMin != null && (
                                            <span>~{app.avgResponseMin} min resp.</span>
                                          )}
                                        </div>
                                      )}
                                      {canModerate && (
                                        <div className="flex gap-2 pt-1">
                                          <button
                                            onClick={() => approveApp.mutate({ applicationId: app.id, operatorId: user?.id ?? '' })}
                                            disabled={approveApp.isPending || !user?.id}
                                            className="flex-1 rounded-lg bg-operational/15 py-1.5 text-xs font-medium text-operational hover:bg-operational/25 transition-colors"
                                          >
                                            Aceptar
                                          </button>
                                          <button
                                            onClick={() => rejectApp.mutate({ applicationId: app.id, operatorId: user?.id ?? '' })}
                                            disabled={rejectApp.isPending || !user?.id}
                                            className="flex-1 rounded-lg bg-critical/15 py-1.5 text-xs font-medium text-critical hover:bg-critical/25 transition-colors"
                                          >
                                            Rechazar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {c.reporterInfo && (c.reporterInfo.name || c.reporterInfo.phone) && (
                        <div className="bg-white/[0.03] rounded-xl p-2.5 space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Contacto del reportante</p>
                          {c.reporterInfo.name && <p className="text-xs text-ink">{c.reporterInfo.name}</p>}
                          {c.reporterInfo.phone && <p className="text-xs text-info">{c.reporterInfo.phone}</p>}
                          {c.reporterInfo.email && <p className="text-xs text-ink-subtle">{c.reporterInfo.email}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )})
            )}
          </div>
        )}

        {tab === 'public-needs' && (
          <div className="h-full overflow-y-auto px-4 pb-nav space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle pt-2">
              Necesidades públicas verificables
            </p>
            {publicNeedsLoading ? (
              [1, 2, 3].map((i) => <GlassCard key={i} className="h-24 animate-pulse" />)
            ) : manageablePublicNeeds.length === 0 ? (
              <GlassCard className="p-4 text-center text-sm text-ink-subtle">
                No hay necesidades activas. Convierte un reporte o publica una convocatoria.
              </GlassCard>
            ) : (
              manageablePublicNeeds.map((need) => {
                const hoursLeft = Math.max(0, Math.round((need.expiresAt.getTime() - Date.now()) / 3600000))
                return (
                  <GlassCard key={need.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink line-clamp-1">{need.title}</p>
                        <p className="mt-0.5 text-xs text-ink-subtle line-clamp-2">{need.summary}</p>
                        <p className="mt-1 text-[11px] text-ink-faint">
                          {need.locationPublic.zone ?? 'Zona por confirmar'} · {need.remainingQuantity} {need.unit} por cubrir
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          need.priority === 'critical'
                            ? 'bg-critical/20 text-critical'
                            : need.priority === 'high'
                              ? 'bg-warning/20 text-warning'
                              : 'bg-info/20 text-info',
                        )}
                      >
                        {label(PRIORITY_LABELS, need.priority, need.priority)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                      <span>{hoursLeft > 0 ? `${hoursLeft}h restantes` : 'Vencida'}</span>
                      <span>{label(PUBLIC_NEED_STATUS_LABELS, need.status, label(NEED_STATUS_LABELS, need.status))}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                      <span className="rounded-lg bg-white/[0.03] px-2 py-1">
                        <span className="block text-ink-faint">Necesario</span>
                        <span className="font-semibold text-ink">{need.requiredQuantity} {need.unit}</span>
                      </span>
                      <span className="rounded-lg bg-white/[0.03] px-2 py-1">
                        <span className="block text-ink-faint">Recibido</span>
                        <span className="font-semibold text-ink">{need.coveredQuantity} {need.unit}</span>
                      </span>
                      <span className="rounded-lg bg-white/[0.03] px-2 py-1">
                        <span className="block text-ink-faint">Faltan</span>
                        <span className="font-semibold text-ink">{need.remainingQuantity} {need.unit}</span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-2.5 py-2 text-[11px]">
                      <span className="text-ink-faint">Convocatoria</span>
                      <span className={cn('font-semibold', need.callStatus === 'open' ? 'text-info' : need.callStatus === 'complete' ? 'text-operational' : 'text-ink-muted')}>
                        {need.callStatus === 'open' ? 'Abierta' : need.callStatus === 'complete' ? 'Completa' : 'Cerrada'}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {need.callStatus !== 'open' && need.callStatus !== 'complete' && (
                        <EmergencyButton
                          variant="primary"
                          size="sm"
                          disabled={verifyPublicNeed.isPending || openNeedCall.isPending || !user?.id}
                          onClick={() => {
                            if (!user?.id) return
                            // Un solo gesto: verificar entrada (si hace falta) + abrir convocatoria.
                            if (need.verificationStatus !== 'approved_entry') {
                              verifyPublicNeed.mutate(
                                {
                                  publicNeedId: need.id,
                                  actorId: user.id,
                                  decision: 'approved',
                                  checklist: [
                                    'Contacto realizado',
                                    'Cantidad definida',
                                    'Ubicación confirmada',
                                    'Consentimiento registrado',
                                  ],
                                  notes: 'Publicada y abierta a voluntarios desde panel gestor',
                                },
                                {
                                  onSuccess: () => {
                                    openNeedCall.mutate({
                                      publicNeedId: need.id,
                                      operatorId: user.id,
                                    })
                                  },
                                },
                              )
                              return
                            }
                            openNeedCall.mutate({ publicNeedId: need.id, operatorId: user.id })
                          }}
                        >
                          Publicar a voluntarios
                        </EmergencyButton>
                      )}
                      {need.callStatus === 'open' && (
                        <EmergencyButton
                          variant="glass"
                          size="sm"
                          disabled={closeNeedCall.isPending || !user?.id}
                          onClick={() => {
                            if (!user?.id) return
                            closeNeedCall.mutate({ publicNeedId: need.id, operatorId: user.id })
                          }}
                        >
                          Cerrar convocatoria
                        </EmergencyButton>
                      )}
                    </div>
                    <div className="mt-2">
                      <NeedInterestsPanel publicNeedId={need.id} operatorId={user?.id} />
                    </div>
                  </GlassCard>
                )
              })
            )}
          </div>
        )}

        {tab === 'missions' && (
          <div className="h-full overflow-y-auto px-4 pb-nav space-y-4">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle pt-2 mb-3">
                Voluntarios interesados
              </p>
              <InterestsPanel />
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-3">Misiones activas</p>
              {activeMissions.length === 0 ? (
                <GlassCard className="p-4 text-center text-sm text-ink-subtle">No hay misiones activas</GlassCard>
              ) : (
                activeMissions.map((m) => (
                  <div key={m.id}>
                    <button onClick={() => setExpandedMissionId(expandedMissionId === m.id ? null : m.id)} className="w-full text-left">
                      <GlassCard className={cn('p-3 transition-all', expandedMissionId === m.id ? 'ring-1 ring-info/30' : '')}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-ink">{m.title}</p>
                          <span className={cn(
                            'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                            m.status === 'completed' || m.status === 'verified' ? 'bg-operational/20 text-operational' :
                            m.status === 'cancelled' || m.status === 'archived' ? 'bg-critical/20 text-critical' :
                            'bg-info/20 text-info',
                          )}>{label(MISSION_STAGE_LABELS, m.status)}</span>
                        </div>
                        <p className="text-xs text-ink-subtle line-clamp-1">{m.description}</p>
                      </GlassCard>
                    </button>
                    {expandedMissionId === m.id && (
                      <MissionDetailCard mission={m} onClose={() => setExpandedMissionId(null)} />
                    )}
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {tab === 'success' && (
          <div className="h-full overflow-y-auto px-4 pb-nav pt-2">
            <SuccessCasesPanel
              emptyDescription="Cuando valides una misión completada, el caso aparecerá aquí como referencia operativa."
            />
          </div>
        )}

        {tab === 'solicitudes' && (
          <div className="h-full overflow-y-auto px-4 pb-nav">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle pt-2 mb-3">Solicitudes de rol</p>
            <RoleRequestAdminPanel />
          </div>
        )}
      </div>

      {esperandoCasoId && (() => {
        const found = allCases?.find((c) => c.id === esperandoCasoId)
        if (!found) return null
        return (
          <EsperarPostulanteModal
            caseData={found}
            open={true}
            onClose={() => setEsperandoCasoId(null)}
            onTimeUp={() => setEsperandoCasoId(null)}
            actorId={user?.id}
          />
        )
      })()}

      {asignandoCasoId && (() => {
        const found = allCases?.find((c) => c.id === asignandoCasoId)
        if (!found) return null
        return (
          <AsignarCentroModal
            caseData={found}
            open={true}
            onClose={() => setAsignandoCasoId(null)}
            actorId={user?.id}
          />
        )
      })()}
    </div>
  )
}
