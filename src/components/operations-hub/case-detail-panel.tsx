import { Phone } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo } from '@/lib/utils'
import type { CaseDomain, CaseDomainEvent, PipelineStage } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { isCoverageStage, isReviewStage } from '@/domain/ops-pipeline'
import type { AssignmentSuggestion } from '@/types/operations-hub.types'
import type { MissionEvent } from '@/domain/mission.types'
import type { MissionAssignment } from '@/domain/mission.types'
import type { CaseApplicationWithApplicant } from '@/domain/case-application.types'
import type { CoverageInterest } from '@/domain/public-need.types'
import { FaroRecommendationPanel } from '@/components/operations-hub/faro-recommendation-panel'
import { CoverageLivePanel } from '@/components/operations-hub/coverage-live-panel'
import {
  getPriorityVisual,
  parseCaseOpsSummary,
  reporterShortLabel,
} from '@/components/operations-hub/case-ops-display'
import { parseQuantityOffered } from '@/domain/case-application-quantity'

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
  onUseInventory?: () => void
  onStartReview?: (caseId: string) => void
  onVerifyAssignment?: (assignmentId: string) => void
  onOpenRadar?: () => void
  canOpenRadar?: boolean
  radarBlockedReason?: string
  /** true si ya hay public_need con call_status=open para este caso */
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

export function CaseDetailPanel({
  caseItem,
  missionAssignments = [],
  coverage,
  suggestions = [],
  inventoryTips = [],
  onTransition,
  onAssign,
  onUseInventory: _onUseInventory,
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
  if (!caseItem) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-center px-6">
          <p className="text-sm text-ink-muted">Selecciona un caso para ver sus detalles</p>
        </div>
      </div>
    )
  }

  const showCoverage = isCoverageStage(caseItem.pipelineStage) || isReviewStage(caseItem.pipelineStage)
  const pendingValidation = missionAssignments.filter((a) => a.status === 'completed')
  const resolved = caseItem.pipelineStage === PIPELINE_STAGES.RESOLVED
  const priority = getPriorityVisual(caseItem.priority, resolved)
  const ops = parseCaseOpsSummary(caseItem)
  const reporter = reporterShortLabel(caseItem)
  const quantityIcon = ops.quantity?.toLowerCase().includes('unidad') ? '💊' : '📦'

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <ScrollArea className={cn('flex-1', dense ? 'px-3 py-3' : 'px-4 py-4')}>
        <div className={cn(dense ? 'space-y-3' : 'space-y-4')}>
          <div className="space-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-sm leading-none" aria-hidden>
                {priority.dot}
              </span>
              <h2
                className={cn(
                  'min-w-0 flex-1 truncate font-semibold leading-tight text-ink',
                  dense ? 'text-base' : 'text-lg',
                )}
              >
                {ops.resource}
              </h2>
            </div>

            <p className="truncate text-[14px] font-medium text-ink/90">📍 {ops.location}</p>

            <div className="space-y-1 pt-0.5">
              {ops.quantity && (
                <p className="text-[14px] text-ink">
                  {quantityIcon} {ops.quantity}
                </p>
              )}
              {ops.people != null && ops.people > 0 && (
                <p className="text-[14px] text-ink">👥 {ops.people} personas</p>
              )}
              <p className="text-[12px] text-ink-muted/60">🕐 {timeAgo(caseItem.createdAt)}</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {needPublished && onViewOnMap ? (
                <EmergencyButton variant="glass" size="sm" onClick={onViewOnMap}>
                  Ver en mapa
                </EmergencyButton>
              ) : onOpenRadar && canOpenRadar ? (
                <EmergencyButton variant="primary" size="sm" onClick={onOpenRadar}>
                  {caseItem.pipelineStage === PIPELINE_STAGES.OPEN_FOR_APPLICATIONS
                    ? 'Abrir convocatoria'
                    : 'Publicar necesidad'}
                </EmergencyButton>
              ) : null}
              {!needPublished && radarBlockedReason && !canOpenRadar && (
                <span className="text-[11px] text-ink-faint">{radarBlockedReason}</span>
              )}
            </div>
          </div>

          {ops.narrative &&
            !ops.narrative.includes('[FARO Wizard]') &&
            ops.narrative !== caseItem.title && (
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm leading-relaxed text-ink-muted">
                {ops.narrative}
              </p>
            )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[12px] text-ink-muted/60">👤 {reporter}</p>
            {caseItem.reporterInfo.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-muted/60">
                <Phone className="h-3 w-3 shrink-0" />
                {caseItem.reporterInfo.phone}
              </p>
            )}
            {caseItem.reporterInfo.relationship && (
              <p className="mt-0.5 text-[11px] text-ink-faint">{caseItem.reporterInfo.relationship}</p>
            )}
          </div>

          {caseItem.pipelineStage === PIPELINE_STAGES.NUEVO && onStartReview && (
            <EmergencyButton
              variant="primary"
              size="sm"
              className="w-full"
              disabled={isTransitioning}
              onClick={() => onStartReview(caseItem.id)}
            >
              Iniciar revisión
            </EmergencyButton>
          )}

          {(isReviewStage(caseItem.pipelineStage) || isCoverageStage(caseItem.pipelineStage)) && (
            <FaroRecommendationPanel
              caseData={caseItem}
              onAssignCenter={onAssign}
              centerFirst={isReviewStage(caseItem.pipelineStage)}
            />
          )}

          {(isCoverageStage(caseItem.pipelineStage) ||
            caseItem.pipelineStage === PIPELINE_STAGES.ASSIGNED ||
            caseItem.pipelineStage === PIPELINE_STAGES.ACCEPTED ||
            caseItem.pipelineStage === PIPELINE_STAGES.IN_ATTENTION) && (
            <CoverageLivePanel caseData={caseItem} />
          )}

          {showCoverage && (
            <CoverageSection
              applications={coverage?.applications ?? []}
              interests={coverage?.interests ?? []}
              centers={coverage?.centers ?? suggestions}
              inventoryTips={inventoryTips}
              onAssign={onAssign}
              assignedCenterId={caseItem.assignedCenterId}
              onApproveApplication={onApproveApplication}
              onRejectApplication={onRejectApplication}
              onApproveInterest={onApproveInterest}
              onRejectInterest={onRejectInterest}
              bestPickupCenterId={inventoryTips[0]?.centerId}
              hideInventoryTip={isReviewStage(caseItem.pipelineStage)}
            />
          )}

          {pendingValidation.length > 0 && onVerifyAssignment && (
            <GlassCard className="!rounded-xl !border-warning/30 !bg-warning/[0.06] !p-3 !shadow-none space-y-2">
              <p className="text-xs font-medium text-warning">
                Entregado — esperando tu validación
              </p>
              {pendingValidation.map((a) => (
                <EmergencyButton
                  key={a.id}
                  variant="primary"
                  size="sm"
                  className="w-full"
                  disabled={isVerifying}
                  onClick={() => onVerifyAssignment(a.id)}
                >
                  Validar y cerrar caso
                </EmergencyButton>
              ))}
            </GlassCard>
          )}

          {onTransition && caseItem.pipelineStage === PIPELINE_STAGES.RESOLVED && (
            <EmergencyButton
              variant="glass"
              size="sm"
              className="w-full"
              onClick={() => onTransition(caseItem.id, PIPELINE_STAGES.ARCHIVED, 'Archivar caso exitoso')}
              disabled={isTransitioning}
            >
              Archivar en historial de éxito
            </EmergencyButton>
          )}
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

function CoverageSection({
  applications,
  interests,
  inventoryTips,
  onAssign,
  onApproveApplication,
  onRejectApplication,
  onApproveInterest,
  onRejectInterest,
  bestPickupCenterId,
  hideInventoryTip = false,
}: {
  applications: CaseApplicationWithApplicant[]
  interests: CoverageInterest[]
  centers: AssignmentSuggestion[]
  inventoryTips: Array<{
    centerId: string
    centerName: string
    available: number
    unit: string
    distanceKm: number
  }>
  onAssign?: (centerId: string) => void
  assignedCenterId?: string
  onApproveApplication?: (applicationId: string, pickupCenterId?: string) => void
  onRejectApplication?: (applicationId: string) => void
  onApproveInterest?: (reservationId: string) => void
  onRejectInterest?: (reservationId: string) => void
  bestPickupCenterId?: string
  hideInventoryTip?: boolean
}) {
  const pendingApps = applications.filter((a) => a.status === 'pending' || a.status === 'under_review')
  const pendingInterests = interests.filter((i) => i.status === 'reserved')
  const tip = hideInventoryTip ? null : inventoryTips[0]
  const empty = pendingApps.length === 0 && pendingInterests.length === 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">Cobertura</p>
      </div>

      {tip && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-operational/20 bg-operational/[0.05] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink">{tip.centerName}</p>
            <p className="text-[10px] text-ink-muted">
              {tip.available} {tip.unit} · {tip.distanceKm.toFixed(1)} km
            </p>
          </div>
          <EmergencyButton variant="glass" size="sm" onClick={() => onAssign?.(tip.centerId)}>
            Pedir
          </EmergencyButton>
        </div>
      )}

      {pendingApps.length > 0 && (
        <ul className="space-y-1.5">
          {pendingApps.slice(0, 4).map((a) => {
            const qty =
              a.quantityOffered ??
              parseQuantityOffered({ message: a.message, availability: a.availability }) ??
              1
            const dist = a.distanceKm != null ? formatDistanceKm(a.distanceKm) : null
            return (
              <li
                key={a.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <p className="truncate text-[13px] text-ink">
                  <span className="font-medium capitalize">{a.applicantName || 'Voluntario'}</span>
                  <span className="text-ink-muted/70">
                    {' '}
                    — Ofrece {qty} {qty === 1 ? 'unidad' : 'unidades'}
                  </span>
                  {dist && <span className="text-ink-muted/60"> — a {dist}</span>}
                </p>
                {(onApproveApplication || onRejectApplication) && (
                  <div className="mt-2 flex gap-1.5">
                    {onApproveApplication && (
                      <EmergencyButton
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => onApproveApplication(a.id, bestPickupCenterId)}
                      >
                        Aceptar
                      </EmergencyButton>
                    )}
                    {onRejectApplication && (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="flex-1"
                        onClick={() => onRejectApplication(a.id)}
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
      )}

      {pendingInterests.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-ink-muted/70">Reservas parciales</p>
          <ul className="space-y-1.5">
            {pendingInterests.slice(0, 4).map((interest) => (
              <li
                key={interest.id}
                className="rounded-lg border border-operational/20 bg-operational/[0.04] px-3 py-2"
              >
                <p className="truncate text-[13px] text-ink">
                  <span className="font-medium capitalize">
                    {interest.collaboratorName || 'Voluntario'}
                  </span>
                  <span className="text-ink-muted/70">
                    {' '}
                    — {interest.quantity} {interest.quantity === 1 ? 'unidad' : 'unidades'}
                  </span>
                  {interest.distanceKm != null && (
                    <span className="text-ink-muted/60"> · {formatDistanceKm(interest.distanceKm)}</span>
                  )}
                </p>
                {(onApproveInterest || onRejectInterest) && (
                  <div className="mt-2 flex gap-1.5">
                    {onApproveInterest && (
                      <EmergencyButton
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => onApproveInterest(interest.id)}
                      >
                        Aceptar reserva
                      </EmergencyButton>
                    )}
                    {onRejectInterest && (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="flex-1"
                        onClick={() => onRejectInterest(interest.id)}
                      >
                        Rechazar
                      </EmergencyButton>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {empty && <p className="text-[11px] text-ink-faint">Sin postulaciones aún.</p>}
    </div>
  )
}
