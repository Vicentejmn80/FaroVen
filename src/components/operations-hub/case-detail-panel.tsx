import { Children } from 'react'
import { Copy, Phone } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo } from '@/lib/utils'
import type { CaseDomain, CaseDomainEvent, PipelineStage } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { isCoverageStage, isProgressStage, isReviewStage } from '@/domain/ops-pipeline'
import {
  canPublishNeed,
  getPublishContextMessage,
  priorityLabel,
} from '@/domain/case-publish-rules'
import type { AssignmentSuggestion } from '@/types/operations-hub.types'
import type { MissionEvent } from '@/domain/mission.types'
import type { MissionAssignment } from '@/domain/mission.types'
import type { CaseApplicationWithApplicant } from '@/domain/case-application.types'
import type { CoverageInterest } from '@/domain/public-need.types'
import { FaroRecommendationPanel } from '@/components/operations-hub/faro-recommendation-panel'
import { CoverageLivePanel } from '@/components/operations-hub/coverage-live-panel'
import { CaseDetailTimeline } from '@/components/operations-hub/case-detail-timeline'
import {
  getPriorityVisual,
  parseCaseOpsSummary,
  reporterShortLabel,
} from '@/components/operations-hub/case-ops-display'
import { parseQuantityOffered } from '@/domain/case-application-quantity'
import { resolveCaseResource } from '@/domain/case-resource'
import { useCaseCoverage } from '@/hooks/useCaseCoverage'
import { useToast } from '@/store/toast-context'
import { CoverageProgressBar } from '@/components/operations-hub/case-ops-display'

interface CoverageBundle {
  applications: CaseApplicationWithApplicant[]
  interests: CoverageInterest[]
  centers: AssignmentSuggestion[]
}

interface CaseDetailPanelProps {
  caseItem: CaseDomain | null
  timeline?: CaseDomainEvent[]
  missionTimeline?: MissionEvent[]
  missionAssignments?: MissionAssignment[]
  coverage?: CoverageBundle
  suggestions?: AssignmentSuggestion[]
  onTransition?: (caseId: string, toStage: PipelineStage, comment?: string) => void
  onAssign?: (centerId: string) => void
  onUseInventory?: () => void
  onStartReview?: (caseId: string) => void
  onVerifyAssignment?: (assignmentId: string) => void
  onOpenRadar?: () => void
  canOpenRadar?: boolean
  radarBlockedReason?: string
  needPublished?: boolean
  onViewOnMap?: () => void
  onApproveApplication?: (applicationId: string, pickupCenterId?: string) => void
  onRejectApplication?: (applicationId: string) => void
  onApproveInterest?: (reservationId: string) => void
  onRejectInterest?: (reservationId: string) => void
  inventoryTips?: Array<{
    centerId: string
    centerName: string
    available: number
    unit: string
    distanceKm: number
  }>
  isTransitioning?: boolean
  isVerifying?: boolean
  className?: string
  dense?: boolean
}

function DetailSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  // Sección huérfana (sin contenido) → ocultarla por completo.
  if (Children.toArray(children).length === 0) return null
  return (
    <section className={cn('space-y-2 border-t border-white/[0.06] pt-3', className)}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function CaseDetailPanel({
  caseItem,
  timeline = [],
  missionTimeline = [],
  missionAssignments = [],
  coverage,
  inventoryTips = [],
  onTransition,
  onAssign,
  onStartReview,
  onVerifyAssignment,
  onOpenRadar,
  canOpenRadar = true,
  radarBlockedReason,
  needPublished = false,
  onViewOnMap,
  onApproveApplication,
  onRejectApplication,
  onApproveInterest,
  onRejectInterest,
  isTransitioning,
  isVerifying,
  className,
  dense = false,
}: CaseDetailPanelProps) {
  const { showToast } = useToast()
  const { data: caseCoverage } = useCaseCoverage(caseItem?.id)

  if (!caseItem) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="px-6 text-center">
          <p className="text-sm text-ink-muted">Selecciona un caso para ver su ficha operativa</p>
        </div>
      </div>
    )
  }

  const resolved = caseItem.pipelineStage === PIPELINE_STAGES.RESOLVED
  const archived = caseItem.pipelineStage === PIPELINE_STAGES.ARCHIVED
  const inProgress = isProgressStage(caseItem.pipelineStage)
  const resourceSpec = resolveCaseResource(caseItem)
  const coverageComplete = caseCoverage?.complete ?? false
  const needsMoreCoverage = !resolved && !archived && !coverageComplete
  const mayPublish =
    canPublishNeed(caseItem.pipelineStage) ||
    (needsMoreCoverage &&
      (inProgress || caseItem.pipelineStage === PIPELINE_STAGES.OPEN_FOR_APPLICATIONS))
  const contextMessage = !mayPublish
    ? getPublishContextMessage(caseItem.pipelineStage, caseItem.resolvedAt)
    : null

  const priority = getPriorityVisual(caseItem.priority, resolved || archived)
  const prio = priorityLabel(caseItem.priority)
  const ops = parseCaseOpsSummary(caseItem)
  const reporter = reporterShortLabel(caseItem)
  const resourceTitle = (ops.resource || resourceSpec.resourceLabel || caseItem.title).toUpperCase()
  const requiredQty = caseCoverage?.required ?? resourceSpec.requiredQty
  const coveredQty = caseCoverage?.covered ?? 0
  const remainingQty = caseCoverage?.remaining ?? Math.max(0, requiredQty - coveredQty)

  const descriptionText =
    ops.narrative &&
    !ops.narrative.includes('[FARO Wizard]') &&
    ops.narrative !== caseItem.title
      ? ops.narrative
      : caseItem.description?.trim() || ''

  const pendingApps = (coverage?.applications ?? []).filter(
    (a) => a.status === 'pending' || a.status === 'under_review',
  )
  const pendingValidation = missionAssignments.filter((a) => a.status === 'completed')
  const showReco =
    isReviewStage(caseItem.pipelineStage) || isCoverageStage(caseItem.pipelineStage)

  const handleCopyPhone = async () => {
    const phone = caseItem.reporterInfo.phone?.trim()
    if (!phone) return
    try {
      await navigator.clipboard.writeText(phone)
      showToast('Número copiado al portapapeles.', 'success')
    } catch {
      showToast('No se pudo copiar el número.', 'warning')
    }
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <ScrollArea className={cn('flex-1', dense ? 'px-3 py-3' : 'px-4 py-4')}>
        <div className={cn(dense ? 'space-y-3' : 'space-y-4')}>
          {/* HEADER operativo */}
          <header className="space-y-1.5">
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5 shrink-0 text-sm leading-none" aria-hidden>
                {priority.dot}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold leading-tight tracking-wide text-ink">
                  {resourceTitle}
                  <span className="ml-1 font-semibold text-ink-muted">
                    — {requiredQty} {requiredQty === 1 ? 'unidad necesaria' : 'unidades necesarias'}
                  </span>
                </h2>
                <p className="mt-1 text-[13px] text-ink/90">
                  📍 {ops.location || caseItem.zone}
                  <span className="mx-1.5 text-ink-faint/50">·</span>
                  <span className={cn('font-semibold', prio.tone)}>{prio.text}</span>
                </p>
                <p className="mt-1 text-[12px] text-ink-muted/70">
                  🕐 Reportado {timeAgo(caseItem.createdAt)}
                </p>
              </div>
            </div>
            {contextMessage && (
              <p className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-ink-muted">
                {contextMessage}
              </p>
            )}
            {!mayPublish && radarBlockedReason && (
              <p className="text-[11px] text-ink-faint">{radarBlockedReason}</p>
            )}
          </header>

          {/* DESCRIPCIÓN DEL CIUDADANO */}
          <DetailSection title="Descripción del ciudadano" className="border-t-0 pt-0">
            {descriptionText ? (
              <blockquote className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[13px] leading-relaxed text-ink/90">
                &ldquo;{descriptionText}&rdquo;
              </blockquote>
            ) : (
              <p className="text-[12px] text-ink-faint">Sin descripción adicional.</p>
            )}
          </DetailSection>

          {/* CONTACTO */}
          <DetailSection title="Contacto">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-1.5">
              <p className="text-[13px] text-ink">👤 {reporter}</p>
              {caseItem.reporterInfo.phone ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {caseItem.reporterInfo.phone}
                  </p>
                  <EmergencyButton variant="glass" size="sm" onClick={() => void handleCopyPhone()}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar número
                  </EmergencyButton>
                </div>
              ) : (
                <p className="text-[12px] text-ink-faint">Sin teléfono registrado.</p>
              )}
              {caseItem.reporterInfo.relationship && (
                <p className="text-[11px] text-ink-faint">{caseItem.reporterInfo.relationship}</p>
              )}
            </div>
          </DetailSection>

          {/* COBERTURA ACUMULATIVA — solo cuando hay cobertura real */}
          {(coveredQty > 0 || (caseCoverage?.contributions.length ?? 0) > 0) && (
            <DetailSection title="Cobertura">
              <div className="space-y-3">
                <CoverageProgressBar current={coveredQty} total={requiredQty} />
                <p className="text-[12px] text-ink-muted">
                  {coveredQty} de {requiredQty} cubiertas (
                  {Math.min(100, Math.round((coveredQty / Math.max(requiredQty, 1)) * 100))}%)
                </p>
                {(caseCoverage?.contributions.length ?? 0) > 0 && (
                  <ul className="space-y-1.5">
                    {caseCoverage!.contributions.map((c) => (
                      <li
                        key={c.assignmentId}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-ink"
                      >
                        <span className="font-medium capitalize">{c.volunteerName}</span>
                        <span className="text-ink-muted/80">
                          {' '}
                          — {c.quantity} u — {c.label} {c.icon}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {remainingQty > 0 && !resolved && (
                  <p className="text-[12px] font-medium text-warning">
                    Faltan {remainingQty} {remainingQty === 1 ? 'unidad' : 'unidades'}
                  </p>
                )}
              </div>
            </DetailSection>
          )}

          {/* COBERTURA DEL CENTRO */}
          {(caseItem.assignedCenterId ||
            isCoverageStage(caseItem.pipelineStage) ||
            inProgress ||
            caseItem.pipelineStage === PIPELINE_STAGES.AWAITING_CENTER_CONFIRMATION) && (
            <DetailSection title="Cobertura del centro">
              <CoverageLivePanel caseData={caseItem} />
            </DetailSection>
          )}

          {/* TIMELINE DEL CASO */}
          <DetailSection title="Timeline del caso">
            <CaseDetailTimeline caseEvents={timeline} missionEvents={missionTimeline} />
          </DetailSection>

          {/* POSTULACIONES PENDIENTES */}
          {pendingApps.length > 0 && (
            <DetailSection title="Postulaciones pendientes">
              <PendingApplicationsList
                applications={pendingApps}
                onApprove={onApproveApplication}
                onReject={onRejectApplication}
                bestPickupCenterId={inventoryTips[0]?.centerId}
              />
            </DetailSection>
          )}

          {/* Reservas parciales (solo si hay) */}
          {(coverage?.interests ?? []).filter((i) => i.status === 'reserved').length > 0 && (
            <DetailSection title="Reservas parciales">
              <PartialInterestsList
                interests={(coverage?.interests ?? []).filter((i) => i.status === 'reserved')}
                onApprove={onApproveInterest}
                onReject={onRejectInterest}
              />
            </DetailSection>
          )}

          {/* Recomendación FARO (solo en revisión/cobertura — herramienta operativa) */}
          {showReco && (
            <DetailSection title="Recomendación FARO">
              <FaroRecommendationPanel
                caseData={caseItem}
                onAssignCenter={onAssign}
                onOpenVolunteerCall={onOpenRadar}
                centerFirst={isReviewStage(caseItem.pipelineStage)}
              />
            </DetailSection>
          )}

          {/* ACCIONES contextuales */}
          <DetailSection title="Acciones">
            <div className="flex flex-wrap gap-2">
              {caseItem.pipelineStage === PIPELINE_STAGES.NUEVO && onStartReview && (
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  disabled={isTransitioning}
                  onClick={() => onStartReview(caseItem.id)}
                >
                  Iniciar revisión
                </EmergencyButton>
              )}

              {mayPublish && needPublished && onViewOnMap && (
                <EmergencyButton variant="glass" size="sm" onClick={onViewOnMap}>
                  Ver mapa
                </EmergencyButton>
              )}

              {needsMoreCoverage && onOpenRadar && (canOpenRadar || inProgress) && (
                <EmergencyButton variant="primary" size="sm" onClick={onOpenRadar}>
                  Publicar necesidad
                </EmergencyButton>
              )}

              {mayPublish && !needPublished && !needsMoreCoverage && onOpenRadar && canOpenRadar && (
                <EmergencyButton variant="primary" size="sm" onClick={onOpenRadar}>
                  {caseItem.pipelineStage === PIPELINE_STAGES.OPEN_FOR_APPLICATIONS
                    ? 'Abrir convocatoria'
                    : 'Publicar necesidad'}
                </EmergencyButton>
              )}

              {mayPublish && !needPublished && radarBlockedReason && !canOpenRadar && (
                <p className="w-full text-[11px] text-ink-faint">{radarBlockedReason}</p>
              )}

              {inProgress && onViewOnMap && (
                <EmergencyButton variant="glass" size="sm" onClick={onViewOnMap}>
                  Ver misión activa
                </EmergencyButton>
              )}

              {pendingValidation.length > 0 && onVerifyAssignment && (
                pendingValidation.map((a) => (
                  <EmergencyButton
                    key={a.id}
                    variant="primary"
                    size="sm"
                    disabled={isVerifying}
                    onClick={() => onVerifyAssignment(a.id)}
                  >
                    {coverageComplete ||
                    coveredQty + (a.quantity ?? 1) >= requiredQty
                      ? 'Validar y cerrar caso'
                      : 'Validar entrega'}
                  </EmergencyButton>
                ))
              )}

              {onTransition && resolved && !archived && (
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  onClick={() =>
                    onTransition(caseItem.id, PIPELINE_STAGES.ARCHIVED, 'Archivar caso exitoso')
                  }
                  disabled={isTransitioning}
                >
                  Archivar en historial de éxito
                </EmergencyButton>
              )}
            </div>
          </DetailSection>
        </div>
      </ScrollArea>
    </div>
  )
}

function formatDistanceKm(km?: number | null): string {
  if (km == null || !Number.isFinite(km)) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function PendingApplicationsList({
  applications,
  onApprove,
  onReject,
  bestPickupCenterId,
}: {
  applications: CaseApplicationWithApplicant[]
  onApprove?: (applicationId: string, pickupCenterId?: string) => void
  onReject?: (applicationId: string) => void
  bestPickupCenterId?: string
}) {
  return (
    <ul className="space-y-2">
      {applications.slice(0, 6).map((a) => {
        const qty =
          a.quantityOffered ??
          parseQuantityOffered({ message: a.message, availability: a.availability }) ??
          1
        const dist = a.distanceKm != null ? formatDistanceKm(a.distanceKm) : null
        const name = a.applicantName || 'Voluntario'
        return (
          <li
            key={a.id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <p className="text-[13px] text-ink">
              <span className="font-medium capitalize">{name}</span>
              <span className="text-ink-muted/80">
                {' '}
                — {qty} u{dist ? ` — ${dist}` : ''}
              </span>
            </p>
            {(onApprove || onReject) && (
              <div className="mt-2 flex gap-1.5">
                {onApprove && (
                  <EmergencyButton
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => onApprove(a.id, bestPickupCenterId)}
                  >
                    Aceptar
                  </EmergencyButton>
                )}
                {onReject && (
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="flex-1"
                    onClick={() => onReject(a.id)}
                  >
                    Rechazar
                  </EmergencyButton>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function PartialInterestsList({
  interests,
  onApprove,
  onReject,
}: {
  interests: CoverageInterest[]
  onApprove?: (reservationId: string) => void
  onReject?: (reservationId: string) => void
}) {
  return (
    <ul className="space-y-2">
      {interests.slice(0, 4).map((interest) => (
        <li
          key={interest.id}
          className="rounded-lg border border-operational/20 bg-operational/[0.04] px-3 py-2.5"
        >
          <p className="text-[13px] text-ink">
            <span className="font-medium capitalize">
              {interest.collaboratorName || 'Voluntario'}
            </span>
            <span className="text-ink-muted/80">
              {' '}
              — {interest.quantity} u
              {interest.distanceKm != null && ` · ${formatDistanceKm(interest.distanceKm)}`}
            </span>
          </p>
          {(onApprove || onReject) && (
            <div className="mt-2 flex gap-1.5">
              {onApprove && (
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => onApprove(interest.id)}
                >
                  Aceptar reserva
                </EmergencyButton>
              )}
              {onReject && (
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  className="flex-1"
                  onClick={() => onReject(interest.id)}
                >
                  Rechazar
                </EmergencyButton>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
