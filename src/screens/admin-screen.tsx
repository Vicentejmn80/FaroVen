import { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { EmptyState } from '@/components/ui/empty-state'
import { RequireRole } from '@/components/auth/require-role'
import { CoordinatorRequestReview } from '@/components/admin/coordinator-request-review'
import { RequestInfoModal } from '@/components/admin/request-info-modal'
import { RegionalOpsDashboard } from '@/components/admin/regional-ops-dashboard'
import { useCoordinatorRequestMutations, usePendingCoordinatorRequests } from '@/hooks/useAuthRequests'
import { useAdminProfiles } from '@/hooks/useAuthRequests'
import { useToast } from '@/store/toast-context'
import { FARO_ROLES } from '@/lib/roles'
import { siteToNeedableType } from '@/lib/site-utils'
import { formatAuthError } from '@/lib/auth-errors'
import { useFaro } from '@/store/faro-context'
import { GlassCard } from '@/components/ui/glass-card'
import { timeAgo } from '@/lib/utils'
import { authService } from '@/services/auth-service'
import { useAuth } from '@/store/auth-context'

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
  const { role } = useAuth()
  const { data: requests = [], isLoading } = usePendingCoordinatorRequests(true)
  const { data: profiles = [], refetch: refetchProfiles } = useAdminProfiles(true)
  const { approve, reject, requestInfo } = useCoordinatorRequestMutations()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [busyRoleRequestId, setBusyRoleRequestId] = useState<string | null>(null)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [roleNotes, setRoleNotes] = useState<Record<string, string>>({})
  const [roleInfoMessages, setRoleInfoMessages] = useState<Record<string, string>>({})

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
  const pendingRoleRequests = profiles.filter(
    (profile) =>
      profile.role_request_status === 'pending' &&
      (profile.pending_role === 'case_manager' || profile.pending_role === 'coordinator'),
  )

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

  async function handleApproveRoleRequest(userId: string, reviewNotes?: string) {
    setError(null)
    setBusyRoleRequestId(userId)
    try {
      await authService.reviewNetworkRoleRequest(userId, true, reviewNotes)
      await refetchProfiles()
      showToast('Solicitud de rol aprobada.', 'success')
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo aprobar'))
    } finally {
      setBusyRoleRequestId(null)
    }
  }

  async function handleRejectRoleRequest(userId: string, reviewNotes?: string) {
    setError(null)
    setBusyRoleRequestId(userId)
    try {
      await authService.reviewNetworkRoleRequest(userId, false, reviewNotes)
      await refetchProfiles()
      showToast('Solicitud de rol rechazada.', 'success')
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo rechazar'))
    } finally {
      setBusyRoleRequestId(null)
    }
  }

  async function handleRequestRoleInfo(userId: string, message: string) {
    setError(null)
    setBusyRoleRequestId(userId)
    try {
      await authService.requestNetworkRoleInfo(userId, message)
      showToast('Se solicitó más información al usuario.', 'success')
      setRoleInfoMessages((prev) => ({ ...prev, [userId]: '' }))
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje'))
    } finally {
      setBusyRoleRequestId(null)
    }
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
        <ContextualHelpCard moduleId="admin" />
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

        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Solicitudes de rol (Gestor/Coordinador)
          </p>

          {pendingRoleRequests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No existen solicitudes de rol pendientes"
              description="Cuando alguien solicite Gestor de Casos o Coordinador, podrás revisarlo aquí."
            />
          ) : (
            pendingRoleRequests.map((profile) => {
              const requestedRoleLabel =
                profile.pending_role === FARO_ROLES.CASE_MANAGER ? 'Gestor de Casos' : 'Coordinador'
              const notes = roleNotes[profile.id] ?? ''
              const infoMessage = roleInfoMessages[profile.id] ?? ''
              const canApprove =
                profile.pending_role !== FARO_ROLES.COORDINATOR || role === FARO_ROLES.SUPER_ADMIN

              return (
                <GlassCard key={profile.id} className="space-y-2">
                  <p className="text-[15px] font-semibold text-ink">{profile.full_name || profile.email}</p>
                  <p className="text-sm text-ink-muted">{profile.email}</p>
                  <p className="text-xs text-info">Solicita: {requestedRoleLabel}</p>
                  {profile.role_request_reason && (
                    <p className="text-xs text-ink-subtle">{profile.role_request_reason}</p>
                  )}
                  <textarea
                    value={notes}
                    onChange={(e) =>
                      setRoleNotes((prev) => ({
                        ...prev,
                        [profile.id]: e.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
                    placeholder="Notas de revisión (opcional)"
                  />
                  <textarea
                    value={infoMessage}
                    onChange={(e) =>
                      setRoleInfoMessages((prev) => ({
                        ...prev,
                        [profile.id]: e.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
                    placeholder="Mensaje para pedir más info (opcional)"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-ink-muted disabled:opacity-50"
                      disabled={busyRoleRequestId === profile.id || !infoMessage.trim()}
                      onClick={() => void handleRequestRoleInfo(profile.id, infoMessage.trim())}
                    >
                      Pedir más info
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-critical disabled:opacity-50"
                      disabled={busyRoleRequestId === profile.id}
                      onClick={() => void handleRejectRoleRequest(profile.id, notes || undefined)}
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-info px-3 py-2 text-xs font-medium text-ink-dark disabled:opacity-50"
                      disabled={busyRoleRequestId === profile.id || !canApprove}
                      onClick={() => void handleApproveRoleRequest(profile.id, notes || undefined)}
                    >
                      {canApprove ? 'Aprobar' : 'Solo Super Admin'}
                    </button>
                  </div>
                </GlassCard>
              )
            })
          )}
        </section>
      </div>
    </ScreenScaffold>
  )
}
