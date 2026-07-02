import { useMemo } from 'react'
import { Check, MessageSquare, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmergencyBadge } from '@/components/faro/emergency-badge'
import { useFaro } from '@/store/faro-context'
import { SITE_META } from '@/lib/status-config'
import { timeAgo } from '@/lib/utils'
import type { CoordinatorRequestRow } from '@/repositories/auth-types'

interface CoordinatorRequestReviewProps {
  request: CoordinatorRequestRow
  assignedSiteId: string
  onAssignedSiteChange: (siteId: string) => void
  onApprove: () => void
  onReject: () => void
  onRequestInfo: () => void
  busy?: boolean
}

export function CoordinatorRequestReview({
  request,
  assignedSiteId,
  onAssignedSiteChange,
  onApprove,
  onReject,
  onRequestInfo,
  busy,
}: CoordinatorRequestReviewProps) {
  const { sites } = useFaro()

  const registeredSites = useMemo(
    () => sites.filter((s) => s.type !== 'organization').sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [sites],
  )

  const requestedSite = registeredSites.find((s) => s.id === request.requested_site_id)
  const assignedSite = registeredSites.find((s) => s.id === assignedSiteId)

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          Información del solicitante
        </p>
        <div>
          <p className="text-xl font-semibold tracking-tight text-ink">{request.full_name}</p>
          <p className="mt-1 text-sm text-ink-muted">{request.email}</p>
          {request.phone && <p className="text-sm text-ink-subtle">{request.phone}</p>}
        </div>
        {(request.role_title || request.organization) && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {request.role_title && (
              <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Cargo</p>
                <p className="text-ink">{request.role_title}</p>
              </div>
            )}
            {request.organization && (
              <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Organización</p>
                <p className="text-ink">{request.organization}</p>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Centro solicitado</p>
        {requestedSite ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[17px] font-semibold text-ink">{requestedSite.name}</p>
                <p className="text-sm text-ink-subtle">
                  {SITE_META[requestedSite.type]?.label} · {requestedSite.zone}
                </p>
              </div>
              <EmergencyBadge status={requestedSite.status} />
            </div>
            <p className="text-xs text-ink-subtle">Actualizado {timeAgo(requestedSite.updatedAt)}</p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">Centro no encontrado en el registro.</p>
        )}

        <label className="block space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Centro a asignar
          </span>
          <select
            value={assignedSiteId}
            onChange={(e) => onAssignedSiteChange(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none"
          >
            <option value="">Seleccionar centro</option>
            {registeredSites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        {assignedSite && assignedSite.id !== requestedSite?.id && (
          <p className="text-xs text-warning">Asignarás un centro distinto al solicitado.</p>
        )}
      </GlassCard>

      {request.reason && (
        <GlassCard className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Motivo</p>
          <p className="text-sm leading-relaxed text-ink-muted">{request.reason}</p>
        </GlassCard>
      )}

      {request.info_request_message && (
        <GlassCard className="space-y-2 border-warning/20 bg-warning/5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">
            Información solicitada
          </p>
          <p className="text-sm leading-relaxed text-ink-muted">{request.info_request_message}</p>
          {request.info_responded_at && request.info_response && (
            <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">Respuesta del solicitante</p>
              <p className="mt-1 text-sm text-ink">{request.info_response}</p>
              <p className="mt-1 text-[11px] text-ink-subtle">
                Recibida {timeAgo(new Date(request.info_responded_at))}
              </p>
            </div>
          )}
          {request.needs_info_response && (
            <p className="text-xs text-warning">Esperando respuesta del solicitante.</p>
          )}
        </GlassCard>
      )}

      <GlassCard className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Historial</p>
        <p className="text-sm text-ink-muted">
          Solicitud recibida {timeAgo(new Date(request.created_at))}. Estado actual: pendiente de revisión.
        </p>
      </GlassCard>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <EmergencyButton variant="primary" size="md" disabled={busy} onClick={onApprove}>
          <Check className="h-4 w-4" /> Aprobar
        </EmergencyButton>
        <EmergencyButton variant="glass" size="md" disabled={busy} onClick={onReject}>
          <X className="h-4 w-4" /> Rechazar
        </EmergencyButton>
        <EmergencyButton variant="glass" size="md" disabled={busy} onClick={onRequestInfo}>
          <MessageSquare className="h-4 w-4" /> Solicitar más información
        </EmergencyButton>
      </div>
    </div>
  )
}
