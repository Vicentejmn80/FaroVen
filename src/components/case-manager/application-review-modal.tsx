import { useMemo } from 'react'
import { Users, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useCaseApplications, useApproveCaseApplication, useRejectCaseApplication } from '@/hooks/useCaseApplications'
import { useCases } from '@/hooks/useCases'
import { useAuth } from '@/store/auth-context'
import { label, SKILL_LABELS } from '@/lib/labels'

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
                disabled={busy || !user?.id}
                onClick={() => {
                  if (!user?.id) return
                  approveApp.mutate(
                    { applicationId: focused.id, operatorId: user.id },
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
