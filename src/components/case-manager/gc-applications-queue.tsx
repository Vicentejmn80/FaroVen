import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/hooks/useGeolocation'
import { label, SKILL_LABELS } from '@/lib/labels'
import { useAuth } from '@/store/auth-context'
import {
  usePendingApplicationsQueue,
  useApproveCaseApplication,
  useRejectCaseApplication,
} from '@/hooks/useCaseApplications'
import { ApplicationReviewModal } from '@/components/case-manager/application-review-modal'
import { useState } from 'react'

function formatRangeToReport(km?: number | null): string {
  if (km == null || !Number.isFinite(km)) return 'Rango no disponible'
  return `${formatDistance(km)} del reporte`
}

/** Cola operativa: voluntarios esperando aprobación del GC (Radar). */
export function GcApplicationsQueue() {
  const { user } = useAuth()
  const { data: queue = [], isLoading } = usePendingApplicationsQueue()
  const approveApp = useApproveCaseApplication()
  const rejectApp = useRejectCaseApplication()
  const [review, setReview] = useState<{ caseId: string; applicationId: string } | null>(null)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-4 pt-safe pb-3 lg:px-8">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO · Gestor</p>
        <h1 className="text-lg font-semibold text-ink">Radar de cobertura</h1>
        <p className="mt-0.5 text-xs text-ink-muted">
          Voluntarios postulados con distancia a la zona del reporte.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-nav space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => <GlassCard key={i} className="h-24 animate-pulse" />)
        ) : queue.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-ink-muted">No hay postulaciones pendientes</p>
            <p className="mt-1 text-xs text-ink-faint">
              Abre el radar desde Operaciones para convocar voluntarios cercanos.
            </p>
          </GlassCard>
        ) : (
          queue.map((app) => (
            <GlassCard key={app.id} className="!p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{app.applicantName}</p>
                  <p className="text-[11px] font-medium text-info">
                    {formatRangeToReport(app.distanceKm)}
                  </p>
                  <p className="text-xs text-ink-muted line-clamp-1">
                    {app.caseTitle ?? app.caseId.slice(0, 8)}
                  </p>
                  {app.organization && (
                    <p className="text-[11px] text-ink-faint">{app.organization}</p>
                  )}
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    app.status === 'pending' ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info',
                  )}
                >
                  {app.status === 'pending' ? 'Pendiente' : 'En revisión'}
                </span>
              </div>

              {app.message && <p className="text-xs text-ink-muted">{app.message}</p>}

              <div className="flex flex-wrap gap-1.5">
                {app.skills?.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-faint"
                  >
                    {label(SKILL_LABELS, s, s)}
                  </span>
                ))}
              </div>

              <div className="flex gap-3 text-[10px] text-ink-faint">
                {app.trustScore != null && <span>Confianza {app.trustScore}%</span>}
                {app.completedMissions != null && <span>{app.completedMissions} misiones</span>}
                {app.avgResponseMin != null && <span>~{app.avgResponseMin} min resp.</span>}
              </div>

              <div className="flex gap-2 pt-1">
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  disabled={approveApp.isPending || !user?.id}
                  onClick={() =>
                    approveApp.mutate({ applicationId: app.id, operatorId: user!.id })
                  }
                >
                  Aceptar
                </EmergencyButton>
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  className="flex-1"
                  disabled={rejectApp.isPending || !user?.id}
                  onClick={() =>
                    rejectApp.mutate({ applicationId: app.id, operatorId: user!.id })
                  }
                >
                  Rechazar
                </EmergencyButton>
                <EmergencyButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setReview({ caseId: app.caseId, applicationId: app.id })}
                >
                  Detalle
                </EmergencyButton>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {review && (
        <ApplicationReviewModal
          open
          caseId={review.caseId}
          applicationId={review.applicationId}
          onClose={() => setReview(null)}
        />
      )}
    </div>
  )
}
