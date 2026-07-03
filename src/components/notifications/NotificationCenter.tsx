import { useState } from 'react'
import { MessageSquare, UserPlus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo } from '@/lib/utils'
import type { AdminNotificationRow } from '@/repositories/notification-repository'

interface NotificationCenterProps {
  open: boolean
  notifications: AdminNotificationRow[]
  loading?: boolean
  onClose: () => void
  onOpenRequest: (requestId: string) => void
  onMarkRead: (notificationId: string) => void
}

export function NotificationCenter({
  open,
  notifications,
  loading,
  onClose,
  onOpenRequest,
  onMarkRead,
}: NotificationCenterProps) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = notifications.find((n) => n.id === detailId)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 p-4 pt-20"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-ink">Notificaciones</p>
                  <p className="text-xs text-ink-subtle">
                    {detail ? 'Detalle' : '¿Qué ocurrió?'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-white/10 hover:text-ink"
                  aria-label="Cerrar notificaciones"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {detail ? (
                <NotificationDetail
                  notification={detail}
                  onBack={() => setDetailId(null)}
                  onOpenRequest={() => {
                    if (detail.status === 'unread') onMarkRead(detail.id)
                    if (detail.related_request_id) {
                      onOpenRequest(detail.related_request_id)
                    }
                  }}
                />
              ) : loading ? (
                <p className="rounded-2xl bg-white/[0.04] px-3 py-4 text-sm text-ink-muted">
                  Cargando notificaciones…
                </p>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title="Sin notificaciones"
                  description="Solicitudes de coordinador y mensajes del Centro de Recursos aparecerán aquí."
                />
              ) : (
                <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
                  {notifications.map((notification) => (
                    <NotificationListItem
                      key={notification.id}
                      notification={notification}
                      onView={() => {
                        if (notification.status === 'unread') onMarkRead(notification.id)
                        setDetailId(notification.id)
                      }}
                    />
                  ))}
                </ul>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function isGuideFeedback(notification: AdminNotificationRow): boolean {
  return notification.type === 'guide_feedback'
}

function NotificationListItem({
  notification,
  onView,
}: {
  notification: AdminNotificationRow
  onView: () => void
}) {
  const payload = notification.payload ?? {}
  const isUnread = notification.status === 'unread'
  const isFeedback = isGuideFeedback(notification)

  return (
    <li>
      <div
        className={`rounded-2xl border px-3 py-3 transition-colors ${
          isUnread
            ? 'border-info/30 bg-info/10'
            : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <p className="text-sm font-medium text-ink">{notification.title}</p>
        {isFeedback ? (
          <>
            <p className="mt-1 text-[15px] text-ink">{payload.category_label ?? 'Mensaje'}</p>
            <p className="line-clamp-2 text-sm text-ink-subtle">{payload.message ?? notification.body}</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-[15px] text-ink">{payload.applicant_name ?? 'Solicitante'}</p>
            <p className="text-sm text-ink-subtle">{payload.center_name ?? 'Centro'}</p>
          </>
        )}
        <p className="mt-1 text-[11px] text-ink-faint">{timeAgo(new Date(notification.created_at))}</p>
        <EmergencyButton variant="glass" size="sm" className="mt-3 w-full" onClick={onView}>
          {isFeedback ? 'Ver mensaje' : 'Ver solicitud'}
        </EmergencyButton>
      </div>
    </li>
  )
}

function NotificationDetail({
  notification,
  onBack,
  onOpenRequest,
}: {
  notification: AdminNotificationRow
  onBack: () => void
  onOpenRequest: () => void
}) {
  const payload = notification.payload ?? {}
  const isFeedback = isGuideFeedback(notification)

  return (
    <div className="space-y-3">
      <button type="button" className="text-sm text-info" onClick={onBack}>
        ← Volver
      </button>
      <GlassCard className="space-y-3 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          {isFeedback && <MessageSquare className="h-4 w-4 text-info" />}
          <p className="text-sm font-medium text-ink">{notification.title}</p>
        </div>
        {isFeedback ? (
          <div className="space-y-2 text-sm">
            <Row label="Tipo" value={payload.category_label ?? '—'} />
            <Row label="Correo" value={payload.sender_email ?? 'No indicado'} />
            <Row label="Fecha" value={new Date(notification.created_at).toLocaleString('es-VE')} />
            <div className="pt-1">
              <p className="text-ink-subtle">Mensaje</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-ink">{payload.message ?? notification.body}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-sm">
              <Row label="Solicitante" value={payload.applicant_name ?? '—'} />
              <Row label="Correo" value={payload.applicant_email ?? '—'} />
              <Row label="Centro" value={payload.center_name ?? '—'} />
              <Row label="Fecha" value={new Date(notification.created_at).toLocaleString('es-VE')} />
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">{notification.body}</p>
          </>
        )}
      </GlassCard>
      {!isFeedback && notification.related_request_id && (
        <EmergencyButton variant="primary" size="md" className="w-full" onClick={onOpenRequest}>
          Ir a revisión
        </EmergencyButton>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-subtle">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  )
}
