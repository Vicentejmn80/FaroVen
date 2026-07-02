import { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { EmptyState } from '@/components/ui/empty-state'
import { RequireRole } from '@/components/auth/require-role'
import { CoordinatorRequestReview } from '@/components/admin/coordinator-request-review'
import { RequestInfoModal } from '@/components/admin/request-info-modal'
import { RegionalOpsDashboard } from '@/components/admin/regional-ops-dashboard'
import { useCoordinatorRequestMutations, usePendingCoordinatorRequests } from '@/hooks/useAuthRequests'
import { useToast } from '@/store/toast-context'
import { FARO_ROLES } from '@/lib/roles'
import { siteToNeedableType } from '@/lib/site-utils'
import { formatAuthError } from '@/lib/auth-errors'
import { useFaro } from '@/store/faro-context'
import { GlassCard } from '@/components/ui/glass-card'
import { timeAgo } from '@/lib/utils'

interface AdminScreenProps {
  onRequestAuth?: () => void
  focusRequestId?: string | null
  onFocusRequestClear?: () => void
}

export function AdminScreen({ onRequestAuth, focusRequestId, onFocusRequestClear }: AdminScreenProps) {
  return (
    <RequireRole
      allowed={[FARO_ROLES.REGIONAL_ADMIN, FARO_ROLES.SUPER_ADMIN]}
      onRequestAuth={onRequestAuth}
    >
      <AdminScreenContent
        focusRequestId={focusRequestId}
        onFocusRequestClear={onFocusRequestClear}
      />
    </RequireRole>
  )
}

function AdminScreenContent({
  focusRequestId,
  onFocusRequestClear,
}: {
  focusRequestId?: string | null
  onFocusRequestClear?: () => void
}) {
  const { sites } = useFaro()
  const { data: requests = [], isLoading } = usePendingCoordinatorRequests(true)
  const { approve, reject, requestInfo } = useCoordinatorRequestMutations()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [infoModalOpen, setInfoModalOpen] = useState(false)

  const registeredSites = useMemo(
    () => sites.filter((s) => s.type !== 'organization').sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [sites],
  )

  useEffect(() => {
    if (!focusRequestId) return
    setActiveRequestId(focusRequestId)
    onFocusRequestClear?.()
  }, [focusRequestId, onFocusRequestClear])

  const activeRequest = requests.find((r) => r.id === activeRequestId)

  async function handleApprove(requestId: string) {
    const siteId = assignments[requestId] ?? activeRequest?.requested_site_id
    if (!siteId) {
      setError('Selecciona un centro para asignar.')
      return
    }
    const site = registeredSites.find((s) => s.id === siteId)
    if (!site) return

    setError(null)
    try {
      await approve.mutateAsync({
        requestId,
        assignedSiteType: siteToNeedableType(site),
        assignedSiteId: site.id,
      })
      showToast('Solicitud aprobada.', 'success')
      setActiveRequestId(null)
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo aprobar'))
    }
  }

  async function handleReject(requestId: string, notes?: string) {
    setError(null)
    try {
      await reject.mutateAsync({ requestId, reviewNotes: notes })
      showToast('Solicitud rechazada.', 'success')
      setActiveRequestId(null)
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo rechazar'))
    }
  }

  async function handleSendInfo(message: string) {
    if (!activeRequest) return
    await requestInfo.mutateAsync({ requestId: activeRequest.id, message })
    showToast('Mensaje enviado. El solicitante lo verá en su campanita.', 'success')
  }

  if (activeRequest) {
    return (
      <>
        <ScreenScaffold
          title="Revisión de solicitud"
          subtitle={activeRequest.full_name}
          onBack={() => setActiveRequestId(null)}
        >
          <div className="space-y-4 pt-2">
            {error && <p className="text-sm text-critical">{error}</p>}
            <CoordinatorRequestReview
              request={activeRequest}
              assignedSiteId={assignments[activeRequest.id] ?? activeRequest.requested_site_id ?? ''}
              onAssignedSiteChange={(siteId) =>
                setAssignments((prev) => ({ ...prev, [activeRequest.id]: siteId }))
              }
              onApprove={() => void handleApprove(activeRequest.id)}
              onReject={() => void handleReject(activeRequest.id)}
              onRequestInfo={() => setInfoModalOpen(true)}
              busy={approve.isPending || reject.isPending}
            />
          </div>
        </ScreenScaffold>

        <RequestInfoModal
          open={infoModalOpen}
          applicantName={activeRequest.full_name}
          applicantEmail={activeRequest.email}
          busy={requestInfo.isPending}
          onClose={() => setInfoModalOpen(false)}
          onSend={handleSendInfo}
        />
      </>
    )
  }

  return (
    <ScreenScaffold title="Administración" subtitle="Centro de operaciones regional">
      <div className="space-y-5 pt-2">
        <RegionalOpsDashboard />

        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Solicitudes pendientes
          </p>

          {error && <p className="text-sm text-critical">{error}</p>}

          {isLoading ? (
            <p className="text-sm text-ink-muted">Cargando solicitudes…</p>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No existen solicitudes pendientes"
              description="Cuando alguien solicite ser coordinador, podrás revisarla aquí."
            />
          ) : (
            requests.map((request) => (
              <GlassCard
                key={request.id}
                className="cursor-pointer space-y-2 transition-colors hover:bg-white/[0.06]"
                onClick={() => setActiveRequestId(request.id)}
              >
                <p className="text-[15px] font-semibold text-ink">{request.full_name}</p>
                <p className="text-sm text-ink-muted">{request.email}</p>
                <p className="text-xs text-ink-subtle">
                  Recibida {timeAgo(new Date(request.created_at))}
                </p>
                <p className="text-xs text-info">Toca para revisar →</p>
              </GlassCard>
            ))
          )}
        </section>
      </div>
    </ScreenScaffold>
  )
}
