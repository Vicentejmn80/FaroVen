import { MapPin, Phone } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo } from '@/lib/utils'
import type { CaseDomain, CaseDomainEvent, PipelineStage } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES, REQUEST_SOURCE_LABELS } from '@/domain/case-lifecycle.types'
import { isCoverageStage, isReviewStage } from '@/domain/ops-pipeline'
import type { AssignmentSuggestion } from '@/types/operations-hub.types'
import { CaseStatusBadge } from './case-status-badge'
import type { MissionEvent } from '@/domain/mission.types'
import type { MissionAssignment } from '@/domain/mission.types'
import type { CaseApplicationWithApplicant } from '@/domain/case-application.types'
import type { CoverageInterest } from '@/domain/public-need.types'
import { OperationalRecoPanel } from '@/components/operations-hub/operational-reco-panel'
import { FaroRecommendationPanel } from '@/components/operations-hub/faro-recommendation-panel'

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
  onUseInventory,
  onStartReview,
  onVerifyAssignment,
  onOpenRadar,
  canOpenRadar = true,
  radarBlockedReason,
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
  const sourceLabel = REQUEST_SOURCE_LABELS[caseItem.requestSource] ?? 'Solicitud'
  const requesterName =
    caseItem.reporterInfo.name ||
    (caseItem.requestSource === 'coordinator' ? 'Coordinador' : null) ||
    (caseItem.requestSource === 'manual' ? 'Gestor' : null) ||
    'Reportante'
  const zone = caseItem.location.address ?? caseItem.location.zone ?? caseItem.zone

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <ScrollArea className={cn('flex-1', dense ? 'px-3 py-3' : 'px-4 py-4')}>
        <div className={cn(dense ? 'space-y-3' : 'space-y-4')}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                {sourceLabel}
              </span>
              <CaseStatusBadge stage={caseItem.pipelineStage} />
            </div>
            <h2 className={cn('font-semibold leading-tight text-ink', dense ? 'text-base' : 'text-lg')}>
              {caseItem.title}
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{zone}</span>
              <span className="text-ink-faint">· {timeAgo(caseItem.createdAt)}</span>
            </p>
          </div>

          {caseItem.description && (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm leading-relaxed text-ink">
              {caseItem.description}
            </p>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{sourceLabel}</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{requesterName}</p>
            {caseItem.reporterInfo.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                <Phone className="h-3 w-3" />
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
            <OperationalRecoPanel
              caseData={caseItem}
              onOpenCoverage={canOpenRadar ? onOpenRadar : undefined}
              onUseInventory={onUseInventory ?? (inventoryTips[0] ? () => onAssign?.(inventoryTips[0].centerId) : undefined)}
              radarBlockedReason={!canOpenRadar ? radarBlockedReason : undefined}
            />
          )}

          {(isReviewStage(caseItem.pipelineStage) || isCoverageStage(caseItem.pipelineStage)) && (
            <FaroRecommendationPanel
              caseData={caseItem}
              onAssignCenter={onAssign}
              onOpenRadar={canOpenRadar ? onOpenRadar : undefined}
              radarBlockedReason={!canOpenRadar ? radarBlockedReason : undefined}
            />
          )}

          {showCoverage && (
            <CoverageSection
              applications={coverage?.applications ?? []}
              interests={coverage?.interests ?? []}
              centers={coverage?.centers ?? suggestions}
              inventoryTips={inventoryTips}
              onAssign={onAssign}
              assignedCenterId={caseItem.assignedCenterId}
              onOpenRadar={canOpenRadar ? onOpenRadar : undefined}
              radarBlockedReason={!canOpenRadar ? radarBlockedReason : undefined}
              onApproveApplication={onApproveApplication}
              onRejectApplication={onRejectApplication}
              onApproveInterest={onApproveInterest}
              onRejectInterest={onRejectInterest}
              bestPickupCenterId={inventoryTips[0]?.centerId}
            />
          )}

          {pendingValidation.length > 0 && onVerifyAssignment && (
            <GlassCard className="!rounded-xl !border-warning/30 !bg-warning/[0.06] !p-3 !shadow-none space-y-2">
              <p className="text-xs font-medium text-warning">Validar evidencia</p>
              {pendingValidation.map((a) => (
                <EmergencyButton
                  key={a.id}
                  variant="primary"
                  size="sm"
                  className="w-full"
                  disabled={isVerifying}
                  onClick={() => onVerifyAssignment(a.id)}
                >
                  Aprobar y resolver
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

function formatRangeToReport(km?: number | null): string {
  if (km == null || !Number.isFinite(km)) return 'Rango no disponible'
  if (km < 1) return `a ${Math.round(km * 1000)} m del reporte`
  return `a ${km.toFixed(1)} km del reporte`
}

function CoverageSection({
  applications,
  interests,
  inventoryTips,
  onAssign,
  onOpenRadar,
  radarBlockedReason,
  onApproveApplication,
  onRejectApplication,
  onApproveInterest,
  onRejectInterest,
  bestPickupCenterId,
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
  onOpenRadar?: () => void
  radarBlockedReason?: string
  onApproveApplication?: (applicationId: string, pickupCenterId?: string) => void
  onRejectApplication?: (applicationId: string) => void
  onApproveInterest?: (reservationId: string) => void
  onRejectInterest?: (reservationId: string) => void
  bestPickupCenterId?: string
}) {
  const pendingApps = applications.filter((a) => a.status === 'pending' || a.status === 'under_review')
  const pendingInterests = interests.filter((i) => i.status === 'reserved')
  const tip = inventoryTips[0]
  const empty = pendingApps.length === 0 && pendingInterests.length === 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">Cobertura</p>
        {onOpenRadar && (
          <EmergencyButton variant="glass" size="sm" onClick={onOpenRadar}>
            Radar
          </EmergencyButton>
        )}
        {radarBlockedReason && !onOpenRadar && (
          <span className="text-[10px] text-ink-faint">{radarBlockedReason}</span>
        )}
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
        <ul className="space-y-2">
          {pendingApps.slice(0, 4).map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <p className="text-sm font-medium text-ink">{a.applicantName || 'Voluntario'}</p>
              <p className="text-[11px] text-ink-muted">{formatRangeToReport(a.distanceKm)}</p>
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
          ))}
        </ul>
      )}

      {pendingInterests.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Reservas parciales
          </p>
          <ul className="space-y-2">
            {pendingInterests.slice(0, 4).map((interest) => (
              <li
                key={interest.id}
                className="rounded-xl border border-operational/20 bg-operational/[0.04] px-3 py-2"
              >
                <p className="text-sm font-medium text-ink">
                  {interest.collaboratorName || 'Voluntario'}
                </p>
                <p className="text-[11px] text-ink-muted">
                  Ofrece {interest.quantity} unidad(es)
                  {interest.distanceKm != null ? ` · ${formatRangeToReport(interest.distanceKm)}` : ''}
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
