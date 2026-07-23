import { Calendar, Clock, MapPin, Phone, User } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo } from '@/lib/utils'
import type { CaseDomain, CaseDomainEvent, PipelineStage } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { getValidTargets } from '@/domain/case-lifecycle.service'
import { slaService } from '@/services/sla-service'
import type { AssignmentSuggestion } from '@/types/operations-hub.types'
import { CaseStatusBadge } from './case-status-badge'
import { INCIDENT_TYPE_LABELS, label } from '@/lib/labels'

interface CaseDetailPanelProps {
  caseItem: CaseDomain | null
  timeline?: CaseDomainEvent[]
  suggestions?: AssignmentSuggestion[]
  onTransition?: (caseId: string, toStage: PipelineStage, comment?: string) => void
  onAssign?: (centerId: string) => void
  isTransitioning?: boolean
  className?: string
  /** Compactación visual para drawer / glass denser. */
  dense?: boolean
}

export function CaseDetailPanel({
  caseItem,
  timeline = [],
  suggestions = [],
  onTransition,
  onAssign,
  isTransitioning,
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
  const availableActions = getAvailableActions(caseItem.pipelineStage)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <ScrollArea className={cn('flex-1', dense ? 'px-3 py-3' : 'px-4 py-4')}>
        <div className={cn(dense ? 'space-y-3' : 'space-y-4')}>
          {/* Header */}
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

          {/* Priority + SLA */}
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

          {/* Ciudadano / contacto */}
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

          {/* Asignación */}
          {caseItem.assignedTo && (
            <GlassCard className="!rounded-xl !border-white/[0.06] !p-3 !shadow-none">
              <p className="text-xs text-ink-muted">Asignado a gestor</p>
              <p className="mt-0.5 text-sm font-medium text-ink">{caseItem.assignedTo}</p>
              {caseItem.assignedCenterId && (
                <p className="mt-0.5 text-xs text-ink-muted">
                  Centro: {caseItem.assignedCenterId}
                </p>
              )}
            </GlassCard>
          )}

          {/* Description */}
          {caseItem.description && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-muted">Necesidades / descripción</p>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm leading-relaxed text-ink">
                {caseItem.description}
              </p>
            </div>
          )}

          {/* Datos del caso */}
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

          {/* Acciones operativas */}
          {availableActions.length > 0 && onTransition && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink-muted">Acciones directas</p>
              <div className="flex flex-wrap gap-1.5">
                {availableActions.map((action) => (
                  <EmergencyButton
                    key={action.value}
                    variant="glass"
                    size="sm"
                    onClick={() => onTransition(caseItem.id, action.value, action.label)}
                    disabled={isTransitioning}
                  >
                    {action.label}
                  </EmergencyButton>
                ))}
              </div>
            </div>
          )}

          {/* Centros sugeridos */}
          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink-muted">Asignar recurso / centro</p>
              <div className="space-y-1">
                {suggestions.slice(0, 3).map((s) => (
                  <SuggestedCenterCard
                    key={s.centerId}
                    suggestion={s}
                    assigned={caseItem.assignedCenterId === s.centerId}
                    onAssign={() => onAssign?.(s.centerId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <CaseTimeline events={timeline} />
        </div>
      </ScrollArea>
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
  const label =
    priority === 'critical' ? 'Crítica'
      : priority === 'high' ? 'Alta prioridad'
        : priority === 'medium' ? 'Prioridad media'
          : 'Prioridad baja'
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2 w-2 rounded-full', color)} />
      <span className="text-xs font-medium text-ink-muted">{label}</span>
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
  const label =
    state === 'breached' ? 'SLA incumplido'
      : state === 'warning' ? 'SLA por vencer'
        : 'SLA en curso'
  return (
    <div className={cn('flex items-center gap-2 rounded-lg px-2 py-1', color)}>
      <Clock className="h-3 w-3" />
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] text-ink-muted">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  )
}

function getAvailableActions(stage: PipelineStage): Array<{ label: string; value: PipelineStage }> {
  const targets = getValidTargets(stage)
  return targets
    .filter((t) => t !== PIPELINE_STAGES.ARCHIVED)
    .map((t) => ({
      label: ACTION_LABELS[t] ?? t,
      value: t,
    }))
}

const ACTION_LABELS: Partial<Record<PipelineStage, string>> = {
  [PIPELINE_STAGES.PENDING_REVIEW]: 'Enviar a revisión',
  [PIPELINE_STAGES.VALIDATING]: 'Validar caso',
  [PIPELINE_STAGES.AWAITING_INFO]: 'Solicitar información',
  [PIPELINE_STAGES.ASSIGNED]: 'Asignar a centro',
  [PIPELINE_STAGES.ACCEPTED]: 'Aceptar asignación',
  [PIPELINE_STAGES.IN_ATTENTION]: 'Iniciar atención',
  [PIPELINE_STAGES.RESOLVED]: 'Resolver caso',
  [PIPELINE_STAGES.ARCHIVED]: 'Archivar',
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
      <p className="text-xs font-medium text-ink-muted">Línea de tiempo</p>
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
                {e.actorId && ` · ${e.actorId}`}
                {e.fromStage && e.toStage && ` · ${e.fromStage} → ${e.toStage}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
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
}
