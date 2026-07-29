import { Calendar, Clock, MapPin, Phone, User } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo } from '@/lib/utils'
import type { CaseDomain, CaseDomainEvent, PipelineStage } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { isCoverageStage, isProgressStage, isReviewStage } from '@/domain/ops-pipeline'
import { slaService } from '@/services/sla-service'
import type { AssignmentSuggestion } from '@/types/operations-hub.types'
import { CaseStatusBadge } from './case-status-badge'
import { INCIDENT_TYPE_LABELS, MISSION_EVENT_LABELS, label } from '@/lib/labels'
import type { MissionEvent } from '@/domain/mission.types'
import type { MissionAssignment } from '@/domain/mission.types'
import type { CaseApplicationWithApplicant } from '@/domain/case-application.types'
import type { CoverageInterest } from '@/domain/public-need.types'

interface CoverageBundle {
  applications: CaseApplicationWithApplicant[]
  interests: CoverageInterest[]
  centers: AssignmentSuggestion[]
}

interface CaseDetailPanelProps {
  caseItem: CaseDomain | null
  timeline?: CaseDomainEvent[]
  /** Timeline vivo de misión (Realtime) — prioridad en En progreso. */
  missionTimeline?: MissionEvent[]
  missionAssignments?: MissionAssignment[]
  coverage?: CoverageBundle
  suggestions?: AssignmentSuggestion[]
  onTransition?: (caseId: string, toStage: PipelineStage, comment?: string) => void
  onAssign?: (centerId: string) => void
  onStartReview?: (caseId: string) => void
  onVerifyAssignment?: (assignmentId: string) => void
  isTransitioning?: boolean
  isVerifying?: boolean
  className?: string
  dense?: boolean
}

export function CaseDetailPanel({
  caseItem,
  timeline = [],
  missionTimeline = [],
  missionAssignments = [],
  coverage,
  suggestions = [],
  onTransition,
  onAssign,
  onStartReview,
  onVerifyAssignment,
  isTransitioning,
  isVerifying,
  className,
  dense = false,
}: CaseDetailPanelProps) {
  if (!caseItem) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-center px-6">
          <p className="text-sm text-ink-muted">Selecciona un caso para ver sus detalles</p>
        </div>
      </div>
    )
  }

  const slaInfo = slaService.getSlaInfo(caseItem)
  const showCoverage = isCoverageStage(caseItem.pipelineStage) || isReviewStage(caseItem.pipelineStage)
  const showMissionLive = isProgressStage(caseItem.pipelineStage)
  const pendingValidation = missionAssignments.filter((a) => a.status === 'completed')

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <ScrollArea className={cn('flex-1', dense ? 'px-3 py-3' : 'px-4 py-4')}>
        <div className={cn(dense ? 'space-y-3' : 'space-y-4')}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted">
                {caseItem.id.slice(0, 8)}
              </p>
              <CaseStatusBadge stage={caseItem.pipelineStage} />
            </div>
            <h2 className={cn('font-semibold leading-tight text-ink', dense ? 'text-base' : 'text-lg')}>
              {caseItem.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{' '}
                {caseItem.location.address ?? caseItem.location.zone ?? caseItem.zone}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {caseItem.reporterInfo.name ?? 'Ciudadano'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {timeAgo(caseItem.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <PriorityBar priority={caseItem.priority} />
            {caseItem.slaDeadline && (
              <SlaIndicator
                deadline={caseItem.slaDeadline}
                progress={slaInfo.progress}
                state={slaInfo.state}
              />
            )}
          </div>

          {caseItem.pipelineStage === PIPELINE_STAGES.NUEVO && onStartReview && (
            <GlassCard className="!rounded-xl !border-info/25 !bg-info/[0.06] !p-3 !shadow-none">
              <p className="text-xs text-ink-muted">
                Reporte recién recibido. Ábrelo para clasificar, contactar y decidir cobertura.
              </p>
              <EmergencyButton
                className="mt-2"
                variant="primary"
                size="sm"
                disabled={isTransitioning}
                onClick={() => onStartReview(caseItem.id)}
              >
                Iniciar revisión
              </EmergencyButton>
            </GlassCard>
          )}

          {caseItem.pipelineStage === PIPELINE_STAGES.AWAITING_INFO && (
            <GlassCard className="!rounded-xl !border-warning/30 !bg-warning/[0.06] !p-3 !shadow-none">
              <p className="text-xs font-medium text-warning">Falta información</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Estado interno dentro de En revisión — contacta al reportante antes de publicar.
              </p>
            </GlassCard>
          )}

          <GlassCard className="!rounded-xl !border-white/[0.08] !p-3 !shadow-none !bg-white/[0.03]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Ciudadano
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {caseItem.reporterInfo.name ?? 'Sin nombre registrado'}
            </p>
            {caseItem.reporterInfo.phone && (
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
                <Phone className="h-3.5 w-3.5" />
                {caseItem.reporterInfo.phone}
              </p>
            )}
            {caseItem.reporterInfo.relationship && (
              <p className="mt-0.5 text-xs text-ink-muted">{caseItem.reporterInfo.relationship}</p>
            )}
          </GlassCard>

          {caseItem.description && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-muted">Necesidades / descripción</p>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm leading-relaxed text-ink">
                {caseItem.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <InfoChip label="Afectados" value={String(caseItem.affectedCount)} />
            {caseItem.category && (
              <InfoChip
                label="Categoría"
                value={label(INCIDENT_TYPE_LABELS, caseItem.category, caseItem.category)}
              />
            )}
            {caseItem.zone && <InfoChip label="Zona" value={caseItem.zone} />}
            <InfoChip label="ID" value={caseItem.id.slice(0, 8)} />
          </div>

          {showCoverage && (
            <CoverageSection
              applications={coverage?.applications ?? []}
              interests={coverage?.interests ?? []}
              centers={coverage?.centers ?? suggestions}
              onAssign={onAssign}
              assignedCenterId={caseItem.assignedCenterId}
            />
          )}

          {showMissionLive && (
            <LiveMissionTimeline events={missionTimeline} />
          )}

          {pendingValidation.length > 0 && onVerifyAssignment && (
            <GlassCard className="!rounded-xl !border-warning/30 !bg-warning/[0.06] !p-3 !shadow-none">
              <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                Panel de validación
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                El voluntario finalizó y subió evidencia. Solo al aprobar el caso pasa a Resuelto.
              </p>
              <div className="mt-2 space-y-2">
                {pendingValidation.map((a) => (
                  <div key={a.id} className="space-y-1.5">
                    {a.evidenceUrls && a.evidenceUrls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {a.evidenceUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-info underline"
                          >
                            Evidencia {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                    {a.feedback && (
                      <p className="text-[11px] text-ink-muted">{a.feedback}</p>
                    )}
                    <EmergencyButton
                      variant="primary"
                      size="sm"
                      disabled={isVerifying}
                      onClick={() => onVerifyAssignment(a.id)}
                    >
                      Aprobar y resolver
                    </EmergencyButton>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {onTransition && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink-muted">Acciones</p>
              <div className="flex flex-wrap gap-1.5">
                {caseItem.pipelineStage !== PIPELINE_STAGES.ARCHIVED &&
                  caseItem.pipelineStage !== PIPELINE_STAGES.RESOLVED && (
                    <EmergencyButton
                      variant="glass"
                      size="sm"
                      onClick={() => onTransition(caseItem.id, PIPELINE_STAGES.ARCHIVED, 'Archivar')}
                      disabled={isTransitioning}
                    >
                      Archivar
                    </EmergencyButton>
                  )}
                {caseItem.pipelineStage === PIPELINE_STAGES.RESOLVED && (
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    onClick={() => onTransition(caseItem.id, PIPELINE_STAGES.ARCHIVED, 'Archivar')}
                    disabled={isTransitioning}
                  >
                    Archivar
                  </EmergencyButton>
                )}
              </div>
              <p className="text-[10px] text-ink-faint">
                Resuelto solo tras validar evidencia. Publicar cobertura y aprobar postulaciones se gestionan en el Gestor de Casos.
              </p>
            </div>
          )}

          {/* Timeline de caso (auditoría) — secundario si hay misión viva */}
          {!showMissionLive && <CaseTimeline events={timeline} />}
        </div>
      </ScrollArea>
    </div>
  )
}

function CoverageSection({
  applications,
  interests,
  centers,
  onAssign,
  assignedCenterId,
}: {
  applications: CaseApplicationWithApplicant[]
  interests: CoverageInterest[]
  centers: AssignmentSuggestion[]
  onAssign?: (centerId: string) => void
  assignedCenterId?: string
}) {
  const pendingApps = applications.filter((a) => a.status === 'pending' || a.status === 'under_review')
  const pendingInterests = interests.filter(
    (i) => i.status === 'reserved' || i.status === 'confirmed',
  )

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink-muted">Cobertura unificada</p>
      <p className="text-[10px] text-ink-faint">
        Voluntarios, instituciones y centros en un solo lugar.
      </p>

      <GlassCard className="!rounded-xl !border-white/[0.06] !p-3 !shadow-none !bg-white/[0.02]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Voluntarios postulados ({pendingApps.length})
        </p>
        {pendingApps.length === 0 ? (
          <p className="mt-1 text-[11px] text-ink-muted">Sin postulaciones pendientes</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {pendingApps.slice(0, 5).map((a) => (
              <li key={a.id} className="text-xs text-ink">
                {a.applicantName || a.applicantId.slice(0, 8)}
                <span className="text-ink-muted"> · {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="!rounded-xl !border-white/[0.06] !p-3 !shadow-none !bg-white/[0.02]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Instituciones interesadas ({pendingInterests.length})
        </p>
        {pendingInterests.length === 0 ? (
          <p className="mt-1 text-[11px] text-ink-muted">Sin intereses institucionales</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {pendingInterests.slice(0, 5).map((i) => (
              <li key={i.id} className="text-xs text-ink">
                {i.collaboratorName ?? i.collaboratorUserId?.slice(0, 8) ?? i.id.slice(0, 8)}
                <span className="text-ink-muted"> · {i.collaboratorType} · {i.status}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {centers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Centros disponibles
          </p>
          <div className="space-y-1">
            {centers.slice(0, 3).map((s) => (
              <SuggestedCenterCard
                key={s.centerId}
                suggestion={s}
                assigned={assignedCenterId === s.centerId}
                onAssign={() => onAssign?.(s.centerId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LiveMissionTimeline({ events }: { events: MissionEvent[] }) {
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-operational">Timeline en vivo</p>
      <p className="text-[10px] text-ink-faint">Actualización por Realtime — sin refrescar</p>
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.08] px-3 py-4 text-center text-[11px] text-ink-muted">
          Esperando eventos del voluntario…
        </p>
      ) : (
        <div className="space-y-0">
          {sorted.map((e) => (
            <div key={e.id} className="flex gap-2.5">
              <div className="flex flex-col items-center pt-1">
                <div className="h-2 w-2 rounded-full bg-operational shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                <div className="w-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <p className="text-[10px] tabular-nums text-ink-faint">
                  {formatClock(e.createdAt)}
                </p>
                <p className="text-xs font-medium text-ink">
                  {e.description || label(MISSION_EVENT_LABELS, e.eventType)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PriorityBar({ priority }: { priority: string }) {
  const color =
    priority === 'critical' || priority === 'high'
      ? 'bg-critical'
      : priority === 'medium'
        ? 'bg-warning'
        : 'bg-white/[0.12]'
  const labelText =
    priority === 'critical' ? 'Crítica'
      : priority === 'high' ? 'Alta prioridad'
        : priority === 'medium' ? 'Prioridad media'
          : 'Prioridad baja'
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2 w-2 rounded-full', color)} />
      <span className="text-xs font-medium text-ink-muted">{labelText}</span>
    </div>
  )
}

function SlaIndicator({
  state,
}: {
  deadline: Date
  progress: number
  state: string
}) {
  const color =
    state === 'breached' ? 'text-critical bg-critical/10'
      : state === 'warning' ? 'text-warning bg-warning/10'
        : 'text-operational bg-operational/10'
  const labelText =
    state === 'breached' ? 'SLA incumplido'
      : state === 'warning' ? 'SLA por vencer'
        : 'SLA en curso'
  return (
    <div className={cn('flex items-center gap-2 rounded-lg px-2 py-1', color)}>
      <Clock className="h-3 w-3" />
      <span className="text-[11px] font-medium">{labelText}</span>
    </div>
  )
}

function InfoChip({ label: chipLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] text-ink-muted">{chipLabel}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  )
}

function SuggestedCenterCard({
  suggestion,
  assigned,
  onAssign,
}: {
  suggestion: AssignmentSuggestion
  assigned: boolean
  onAssign: () => void
}) {
  const satColor =
    suggestion.saturation === 'critical'
      ? 'text-critical'
      : suggestion.saturation === 'high'
        ? 'text-warning'
        : 'text-operational'
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border px-3 py-2',
        assigned ? 'border-info/30 bg-info/[0.04]' : 'border-white/[0.06] bg-white/[0.02]',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{suggestion.centerName}</p>
        <p className="text-[11px] text-ink-muted">
          {suggestion.distance} · <span className={satColor}>{suggestion.saturation}</span>
        </p>
      </div>
      {!assigned && (
        <EmergencyButton variant="glass" size="sm" onClick={onAssign}>
          Asignar
        </EmergencyButton>
      )}
    </div>
  )
}

function CaseTimeline({ events }: { events: CaseDomainEvent[] }) {
  if (events.length === 0) return null
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink-muted">Auditoría del caso</p>
      <div className="space-y-0">
        {sorted.map((e) => (
          <div key={e.id} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <div className="h-2 w-2 rounded-full bg-white/[0.12]" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <p className="text-xs text-ink">
                {e.comment || EVENT_LABELS[e.eventType] || e.eventType}
              </p>
              <p className="text-[10px] text-ink-muted">
                {timeAgo(e.createdAt)}
                {e.fromStage && e.toStage && ` · ${e.fromStage} → ${e.toStage}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatClock(d: Date): string {
  try {
    return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const EVENT_LABELS: Record<string, string> = {
  case_submitted: 'Caso creado',
  case_review_started: 'Revisión iniciada',
  case_validated: 'Caso validado',
  case_info_requested: 'Información solicitada',
  case_info_received: 'Información recibida',
  case_assigned: 'Caso asignado',
  case_accepted: 'Asignación aceptada',
  case_attention_started: 'Atención iniciada',
  case_resolved: 'Caso resuelto',
  case_reopened: 'Caso reabierto',
  case_closed: 'Caso cerrado',
  case_dismissed: 'Caso descartado',
  case_stale_archived: 'Archivado por inactividad',
  case_unable_to_assign: 'No se pudo asignar',
  case_opened_for_applications: 'Cobertura abierta',
  case_awaiting_center: 'Centro propuesto',
  case_center_confirmed: 'Centro confirmado',
}
