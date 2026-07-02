import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCircle2, MessageSquare, ShieldCheck, X, XCircle } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo } from '@/lib/utils'
import type { UserNotificationRow } from '@/repositories/user-notification-repository'

export const USER_NOTIFICATION_TYPES = {
  INFO_REQUEST: 'coordinator_info_request',
  APPROVED: 'coordinator_request_approved',
  REJECTED: 'coordinator_request_rejected',
} as const

interface UserNotificationSheetProps {
  open: boolean
  notifications: UserNotificationRow[]
  loading?: boolean
  onClose: () => void
  onOpenRequest: () => void
  onGoToCoordinatorOps: () => void
  onMarkRead: (notificationId: string) => void
}

export function UserNotificationSheet({
  open,
  notifications,
  loading,
  onClose,
  onOpenRequest,
  onGoToCoordinatorOps,
  onMarkRead,
}: UserNotificationSheetProps) {
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
            animate={{ opacity: 1, y: 0, scale: 1 }}
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
                    {detail ? 'Detalle' : 'Actualizaciones sobre tu solicitud'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-ink-subtle hover:bg-white/10 hover:text-ink"
                  aria-label="Cerrar"
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
                    onOpenRequest()
                    onClose()
                  }}
                  onGoToCoordinatorOps={() => {
                    if (detail.status === 'unread') onMarkRead(detail.id)
                    onGoToCoordinatorOps()
                    onClose()
                  }}
                />
              ) : loading ? (
                <p className="text-sm text-ink-muted">Cargando…</p>
              ) : notifications.length === 0 ? (
                <EmptyState icon={Bell} title="Sin notificaciones" description="Aquí verás mensajes de los administradores." />
              ) : (
                <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (n.status === 'unread') onMarkRead(n.id)
                          setDetailId(n.id)
                        }}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                          n.status === 'unread'
                            ? notificationAccentClass(n.type)
                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                        }`}
                      >
                        <p className="text-sm font-medium text-ink">{n.title}</p>
                        <p className="mt-0.5 text-xs text-ink-subtle">{n.body}</p>
                        <p className="mt-1 text-[11px] text-ink-faint">{timeAgo(new Date(n.created_at))}</p>
                      </button>
                    </li>
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

function notificationAccentClass(type: string): string {
  if (type === USER_NOTIFICATION_TYPES.APPROVED) {
    return 'border-operational/30 bg-operational/10 hover:bg-operational/15'
  }
  if (type === USER_NOTIFICATION_TYPES.REJECTED) {
    return 'border-critical/30 bg-critical/10 hover:bg-critical/15'
  }
  return 'border-warning/30 bg-warning/10 hover:bg-warning/15'
}

function NotificationDetail({
  notification,
  onBack,
  onOpenRequest,
  onGoToCoordinatorOps,
}: {
  notification: UserNotificationRow
  onBack: () => void
  onOpenRequest: () => void
  onGoToCoordinatorOps: () => void
}) {
  const adminMessage = notification.payload?.admin_message
  const reviewNotes = notification.payload?.review_notes
  const centerName = notification.payload?.center_name

  return (
    <div className="space-y-3">
      <button type="button" className="text-sm text-info" onClick={onBack}>
        ← Volver
      </button>
      <GlassCard className="space-y-2 bg-white/[0.03]">
        <NotificationIcon type={notification.type} />
        <p className="text-sm font-medium text-ink">{notification.title}</p>
        <p className="text-sm text-ink-muted">{notification.body}</p>
        {centerName && notification.type !== USER_NOTIFICATION_TYPES.INFO_REQUEST && (
          <p className="text-xs text-ink-subtle">Centro: {centerName}</p>
        )}
        {adminMessage && (
          <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Mensaje del administrador</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{adminMessage}</p>
          </div>
        )}
        {reviewNotes && notification.type === USER_NOTIFICATION_TYPES.REJECTED && (
          <div className="rounded-2xl bg-critical/10 px-3 py-2.5 ring-1 ring-critical/20">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Motivo del rechazo</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{reviewNotes}</p>
          </div>
        )}
      </GlassCard>
      {notification.type === USER_NOTIFICATION_TYPES.INFO_REQUEST && (
        <EmergencyButton variant="primary" size="md" className="w-full" onClick={onOpenRequest}>
          <MessageSquare className="h-4 w-4" /> Responder solicitud
        </EmergencyButton>
      )}
      {notification.type === USER_NOTIFICATION_TYPES.APPROVED && (
        <EmergencyButton variant="primary" size="md" className="w-full" onClick={onGoToCoordinatorOps}>
          <ShieldCheck className="h-4 w-4" /> Ir a Mi Centro
        </EmergencyButton>
      )}
    </div>
  )
}

function NotificationIcon({ type }: { type: string }) {
  if (type === USER_NOTIFICATION_TYPES.APPROVED) {
    return <CheckCircle2 className="h-6 w-6 text-operational" aria-hidden />
  }
  if (type === USER_NOTIFICATION_TYPES.REJECTED) {
    return <XCircle className="h-6 w-6 text-critical" aria-hidden />
  }
  return <MessageSquare className="h-6 w-6 text-warning" aria-hidden />
}
