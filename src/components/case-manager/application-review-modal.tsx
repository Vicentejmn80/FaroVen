import { useMemo, useState } from 'react'
import { Users, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useCaseApplications, useApproveCaseApplication, useRejectCaseApplication } from '@/hooks/useCaseApplications'
import { useCases } from '@/hooks/useCases'
import { useRecommendedCenters } from '@/hooks/useLogistics'
import { useAuth } from '@/store/auth-context'
import { label, SKILL_LABELS } from '@/lib/labels'
import { resolveCatalogKey } from '@/lib/resource-catalog'
import { cn } from '@/lib/utils'

interface ApplicationReviewModalProps {
  caseId: string
  applicationId?: string | null
  open: boolean
  onClose: () => void
}

/**
 * Modal GC: aceptar / rechazar postulación desde la campanita.
 */
export function ApplicationReviewModal({
  caseId,
  applicationId,
  open,
  onClose,
}: ApplicationReviewModalProps) {
  const { user } = useAuth()
  const { data: cases } = useCases()
  const { data: applications = [], isLoading } = useCaseApplications(open ? caseId : undefined)
  const approveApp = useApproveCaseApplication()
  const rejectApp = useRejectCaseApplication()

  const caseData = useMemo(() => cases?.find((c) => c.id === caseId), [cases, caseId])
  const isTransferCase = caseData?.operationType === 'transfer'
  const catalogKey = resolveCatalogKey(caseData?.category) ?? 'agua'
  const minQty = Math.max(1, caseData?.affectedCount || 1)

  const { data: recommended = [] } = useRecommendedCenters({
    resourceType: catalogKey,
    minQty,
    missionLat: caseData?.location.lat,
    missionLng: caseData?.location.lng,
    enabled: open && isTransferCase,
  })
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null)

  const logisticsMeta = caseData?.metadata?.logistics as { originCenterId?: string } | undefined
  const defaultCenterId = logisticsMeta?.originCenterId ?? recommended[0]?.centerId
  const pickupCenterId = selectedCenterId ?? defaultCenterId

  const pending = useMemo(
    () => applications.filter((a) => a.status === 'pending' || a.status === 'under_review'),
    [applications],
  )

  const focused = useMemo(() => {
    if (applicationId) {
      return applications.find((a) => a.id === applicationId) ?? pending[0] ?? null
    }
    return pending[0] ?? null
  }, [applicationId, applications, pending])

  if (!open) return null

  const busy = approveApp.isPending || rejectApp.isPending

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <GlassCard className="w-full max-w-md space-y-4 border-info/20 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-info">
              Nueva postulación
            </p>
            <h2 className="text-base font-semibold text-ink">
              {caseData?.title ?? 'Caso operativo'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              ¿Aceptas a este voluntario para la misión?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-subtle hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-ink-muted">Cargando postulaciones…</p>
        ) : !focused ? (
          <p className="rounded-xl bg-white/[0.04] px-3 py-4 text-sm text-ink-muted">
            No hay postulaciones pendientes en este caso.
          </p>
        ) : (
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-info" />
              <p className="text-sm font-medium text-ink">
                {focused.applicantName || 'Voluntario'}
              </p>
            </div>
            {focused.message && (
              <p className="text-xs text-ink-muted">«{focused.message}»</p>
            )}
            {focused.skills && focused.skills.length > 0 && (
              <p className="text-[11px] text-ink-faint">
                Habilidades:{' '}
                {focused.skills.map((s) => label(SKILL_LABELS, s, s)).join(', ')}
              </p>
            )}
            {focused.applicantPhone && (
              <p className="text-[11px] text-ink-faint">Tel: {focused.applicantPhone}</p>
            )}

            {isTransferCase && recommended.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-info/20 bg-info/[0.05] p-2.5">
                <p className="text-[11px] font-medium text-ink">Centro de recogida recomendado</p>
                <div className="space-y-1">
                  {recommended.slice(0, 3).map((center) => (
                    <button
                      key={center.centerId}
                      type="button"
                      onClick={() => setSelectedCenterId(center.centerId)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-[11px]',
                        pickupCenterId === center.centerId
                          ? 'border-info/50 bg-info/15 text-ink'
                          : 'border-white/10 bg-white/[0.03] text-ink-muted',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{center.centerName}</span>
                        <span className="text-[10px] text-ink-faint">
                          {center.distanceKm} km · {center.available} disponibles
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {pickupCenterId && (
                  <p className="text-[10px] text-ink-faint">
                    Se reservará {minQty} en el centro seleccionado al aceptar.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <EmergencyButton
                variant="glass"
                size="md"
                disabled={busy || !user?.id}
                onClick={() => {
                  if (!user?.id) return
                  rejectApp.mutate(
                    { applicationId: focused.id, operatorId: user.id },
                    { onSuccess: () => onClose() },
                  )
                }}
              >
                Rechazar
              </EmergencyButton>
              <EmergencyButton
                variant="primary"
                size="md"
                disabled={busy || !user?.id || (isTransferCase && !pickupCenterId)}
                onClick={() => {
                  if (!user?.id) return
                  approveApp.mutate(
                    {
                      applicationId: focused.id,
                      operatorId: user.id,
                      pickupCenterId: isTransferCase ? pickupCenterId : undefined,
                    },
                    { onSuccess: () => onClose() },
                  )
                }}
              >
                {approveApp.isPending ? 'Aceptando…' : 'Aceptar'}
              </EmergencyButton>
            </div>
          </div>
        )}

        {pending.length > 1 && (
          <p className="text-[11px] text-ink-faint">
            +{pending.length - 1} postulación(es) más en este caso — revisa la bandeja del gestor.
          </p>
        )}
      </GlassCard>
    </div>
  )
}
