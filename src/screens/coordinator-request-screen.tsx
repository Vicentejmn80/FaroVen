import { useRef, useState } from 'react'
import { CheckCircle2, Send, XCircle } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useFaro } from '@/store/faro-context'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorRequestMutations, useMyCoordinatorRequests } from '@/hooks/useAuthRequests'
import {
  CoordinatorRequestSuccess,
  CoordinatorRequestWizard,
} from '@/components/coordinator/coordinator-request-wizard'
import { CoordinatorInfoRespondPanel } from '@/components/coordinator/coordinator-info-respond-panel'
import { siteToNeedableType } from '@/lib/site-utils'
import { COORDINATOR_REQUEST_STATUS, COORDINATOR_REQUEST_STATUS_LABELS, FARO_ROLES } from '@/lib/roles'
import { formatAuthError } from '@/lib/auth-errors'
import { InvisibleTurnstile, type InvisibleTurnstileHandle } from '@/components/security/invisible-turnstile'

interface CoordinatorRequestScreenProps {
  onNeedAuth: () => void
  onClose?: () => void
}

export function CoordinatorRequestScreen({ onNeedAuth, onClose }: CoordinatorRequestScreenProps) {
  const { sites } = useFaro()
  const { user, role } = useAuth()
  const { data: myRequests = [], refetch } = useMyCoordinatorRequests()
  const { submit, respondInfo } = useCoordinatorRequestMutations()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [retryAfterReject, setRetryAfterReject] = useState(false)
  const turnstileRef = useRef<InvisibleTurnstileHandle>(null)

  const pendingRequest = myRequests.find((r) => r.status === COORDINATOR_REQUEST_STATUS.PENDING)
  const latestRequest = myRequests[0]
  const approvedRequest = myRequests.find(
    (r) =>
      r.status === COORDINATOR_REQUEST_STATUS.APPROVED &&
      r.auth_user_id === user?.id &&
      role === FARO_ROLES.COORDINATOR,
  )
  const rejectedRequest = myRequests.find(
    (r) => r.status === COORDINATOR_REQUEST_STATUS.REJECTED && r.auth_user_id === user?.id,
  )

  async function handleSubmit(data: {
    fullName: string
    email: string
    phone: string
    roleTitle: string
    organization: string
    selectedSiteId: string
    reason: string
    experience: string
  }) {
    if (!user) {
      onNeedAuth()
      return
    }

    const reasonText = data.experience.trim()
      ? `${data.reason.trim()}\n\nExperiencia: ${data.experience.trim()}`
      : data.reason.trim()

    setError(null)
    try {
      if (import.meta.env.VITE_TURNSTILE_SITE_KEY) {
        const token = await turnstileRef.current?.requestToken()
        if (!token) {
          setError('No pudimos verificar la seguridad del formulario. Intenta nuevamente.')
          return
        }
      }
      const site = sites.find((s) => s.id === data.selectedSiteId)
      if (!site || site.type === 'organization') {
        setError('Selecciona un centro válido.')
        return
      }
      await submit.mutateAsync({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || undefined,
        organization: data.organization || undefined,
        requestedSiteType: siteToNeedableType(site),
        requestedSiteId: data.selectedSiteId,
        roleTitle: data.roleTitle || undefined,
        reason: reasonText,
      })
      setSent(true)
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud'))
    }
  }

  if (pendingRequest?.needs_info_response) {
    return (
      <ScreenScaffold
        title="Ampliar solicitud"
        subtitle="Información adicional requerida"
        onBack={onClose}
      >
        <div className="space-y-4 pt-2">
          <CoordinatorInfoRespondPanel
            request={pendingRequest}
            submitting={respondInfo.isPending}
            onSubmit={async (response) => {
              await respondInfo.mutateAsync({ requestId: pendingRequest.id, response })
              await refetch()
            }}
          />
        </div>
      </ScreenScaffold>
    )
  }

  if (approvedRequest && !pendingRequest) {
    const centerId = approvedRequest.assigned_site_id ?? approvedRequest.requested_site_id
    const centerName = centerId ? sites.find((s) => s.id === centerId)?.name : undefined

    return (
      <ScreenScaffold title="Solicitud aprobada" subtitle="Acceso como coordinador" onBack={onClose}>
        <GlassCard className="space-y-4 pt-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-operational/15 ring-1 ring-operational/25">
            <CheckCircle2 className="h-7 w-7 text-operational" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-ink">¡Aprobado!</p>
            <p className="text-sm leading-relaxed text-ink-muted">
              {centerName
                ? `Ahora eres coordinador de ${centerName}. Puedes acceder a tu panel desde la pestaña Mi Centro.`
                : 'Tu solicitud fue aprobada. Puedes acceder a tu panel desde la pestaña Mi Centro.'}
            </p>
          </div>
        </GlassCard>
      </ScreenScaffold>
    )
  }

  if (rejectedRequest && !pendingRequest && !sent && !retryAfterReject) {
    return (
      <ScreenScaffold title="Solicitud rechazada" subtitle="Acceso como coordinador" onBack={onClose}>
        <GlassCard className="space-y-4 pt-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-critical/15 ring-1 ring-critical/25">
            <XCircle className="h-7 w-7 text-critical" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-ink">Solicitud rechazada</p>
            <p className="text-sm leading-relaxed text-ink-muted">
              Un administrador rechazó tu solicitud
              {rejectedRequest.review_notes ? `: ${rejectedRequest.review_notes}` : '.'} Puedes enviar una
              nueva solicitud con información actualizada.
            </p>
          </div>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={() => setRetryAfterReject(true)}>
            Enviar nueva solicitud
          </EmergencyButton>
        </GlassCard>
      </ScreenScaffold>
    )
  }

  if (pendingRequest || sent) {
    const request = pendingRequest ?? latestRequest
    return (
      <ScreenScaffold title="Solicitud enviada" subtitle="Acceso como coordinador" onBack={onClose}>
        <CoordinatorRequestSuccess />
        {request && (
          <GlassCard className="mt-4 text-center text-xs text-ink-subtle">
            Estado: {COORDINATOR_REQUEST_STATUS_LABELS[request.status as keyof typeof COORDINATOR_REQUEST_STATUS_LABELS]}
          </GlassCard>
        )}
      </ScreenScaffold>
    )
  }

  return (
    <ScreenScaffold title="Solicitar acceso" subtitle="Proceso guiado · 3 pasos" onBack={onClose}>
      <div className="space-y-4 pt-2">
        <GlassCard className="flex items-start gap-3">
          <Send className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <p className="text-sm leading-relaxed text-ink-muted">
            Un administrador regional revisará tu solicitud antes de asignarte un centro.
          </p>
        </GlassCard>

        <CoordinatorRequestWizard
          initialData={{
            fullName: user?.user_metadata?.full_name ?? '',
            email: user?.email ?? '',
          }}
          onSubmit={handleSubmit}
          submitting={submit.isPending}
          error={error}
        />
      </div>
      <InvisibleTurnstile ref={turnstileRef} action="coordinator-request" />
    </ScreenScaffold>
  )
}
