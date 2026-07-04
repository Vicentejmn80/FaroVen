import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellRing, CheckCheck, Trash2, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo } from '@/lib/utils'
import { getNotificationActionLabel } from '@/lib/notification-routing'
import {
  groupNotificationsByTime,
  priorityBadgeClass,
  priorityClass,
  priorityLabel,
} from '@/lib/notification-groups'
import { notificationIcon } from '@/lib/notification-icons'
import type { NotificationRow } from '@/domain/notification-models'

interface NotificationHubProps {
  open: boolean
  notifications: NotificationRow[]
  loading?: boolean
  pushAvailable?: boolean
  onClose: () => void
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDelete: (id: string) => void
  onAction: (notification: NotificationRow) => void
  onEnablePush?: () => void
}

export function NotificationHub({
  open,
  notifications,
  loading,
  pushAvailable,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onAction,
  onEnablePush,
}: NotificationHubProps) {
  const groups = useMemo(() => groupNotificationsByTime(notifications), [notifications])
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])
  const [detail, setDetail] = useState<NotificationRow | null>(null)

  const handleClose = () => {
    setDetail(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 p-4 pt-20"
          onClick={handleClose}
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
                    {detail ? 'Detalle' : unreadCount > 0 ? `${unreadCount} sin leer` : 'Centro de alertas FARO'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-white/10 hover:text-ink"
                  aria-label="Cerrar notificaciones"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!detail && pushAvailable && onEnablePush && (
                <button
                  type="button"
                  onClick={onEnablePush}
                  className="flex w-full items-center gap-2 rounded-2xl border border-info/25 bg-info/10 px-3 py-2.5 text-left text-sm text-info transition-colors hover:bg-info/15"
                >
                  <BellRing className="h-4 w-4 shrink-0" />
                  Activar alertas en este dispositivo
                </button>
              )}

              {!detail && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="flex items-center gap-1.5 text-xs text-info hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas como leídas
                </button>
              )}

              {detail ? (
                <NotificationDetail
                  notification={detail}
                  onBack={() => setDetail(null)}
                  onAction={() => {
                    if (!detail.read) onMarkRead(detail.id)
                    onAction(detail)
                  }}
                  onDelete={() => {
                    onDelete(detail.id)
                    setDetail(null)
                  }}
                />
              ) : loading ? (
                <p className="rounded-2xl bg-white/[0.04] px-3 py-4 text-sm text-ink-muted">
                  Cargando notificaciones…
                </p>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="Sin notificaciones"
                  description="Solicitudes, reportes, mensajes y alertas operativas aparecerán aquí."
                />
              ) : (
                <div className="max-h-[55vh] space-y-4 overflow-y-auto">
                  {groups.map((group) => (
                    <section key={group.key} className="space-y-2">
                      <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                        {group.label}
                      </p>
                      <ul className="space-y-2">
                        {group.items.map((notification) => (
                          <NotificationCard
                            key={notification.id}
                            notification={notification}
                            onOpen={() => {
                              if (!notification.read) onMarkRead(notification.id)
                              setDetail(notification)
                            }}
                            onQuickAction={() => {
                              if (!notification.read) onMarkRead(notification.id)
                              onAction(notification)
                            }}
                            onDelete={() => onDelete(notification.id)}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function NotificationCard({
  notification,
  onOpen,
  onQuickAction,
  onDelete,
}: {
  notification: NotificationRow
  onOpen: () => void
  onQuickAction: () => void
  onDelete: () => void
}) {
  const Icon = notificationIcon(notification.type, notification.icon)
  const actionLabel = getNotificationActionLabel(notification.action_url, notification.type)

  return (
    <li>
      <div
        className={`rounded-2xl border px-3 py-3 transition-colors ${priorityClass(notification.priority, !notification.read)}`}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
            <Icon className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium text-ink">{notification.title}</p>
              {!notification.read && <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden />}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${priorityBadgeClass(notification.priority)}`}
              >
                {priorityLabel(notification.priority)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-subtle">{notification.message}</p>
            <p className="mt-1 text-[11px] text-ink-faint">{timeAgo(new Date(notification.created_at))}</p>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1 text-ink-faint hover:bg-white/10 hover:text-critical"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          {notification.action_url && (
            <EmergencyButton variant="primary" size="sm" className="flex-1" onClick={onQuickAction}>
              {actionLabel}
            </EmergencyButton>
          )}
          <EmergencyButton variant="glass" size="sm" className={notification.action_url ? '' : 'w-full'} onClick={onOpen}>
            Ver detalle
          </EmergencyButton>
        </div>
      </div>
    </li>
  )
}

function NotificationDetail({
  notification,
  onBack,
  onAction,
  onDelete,
}: {
  notification: NotificationRow
  onBack: () => void
  onAction: () => void
  onDelete: () => void
}) {
  const Icon = notificationIcon(notification.type, notification.icon)
  const actionLabel = getNotificationActionLabel(notification.action_url, notification.type)
  const meta = notification.metadata ?? {}

  return (
    <div className="space-y-3">
      <button type="button" className="text-sm text-info" onClick={onBack}>
        ← Volver
      </button>
      <GlassCard className="space-y-3 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-info" />
          <p className="text-sm font-medium text-ink">{notification.title}</p>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${priorityBadgeClass(notification.priority)}`}
          >
            {priorityLabel(notification.priority)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">{notification.message}</p>
        <p className="text-xs text-ink-faint">{new Date(notification.created_at).toLocaleString('es-VE')}</p>
        {Object.keys(meta).length > 0 && (
          <div className="space-y-1.5 border-t border-white/10 pt-2 text-sm">
            {typeof meta.applicant_name === 'string' && (
              <MetaRow label="Solicitante" value={meta.applicant_name} />
            )}
            {typeof meta.applicant_email === 'string' && <MetaRow label="Correo" value={meta.applicant_email} />}
            {typeof meta.center_name === 'string' && <MetaRow label="Centro" value={meta.center_name} />}
            {typeof meta.site_name === 'string' && <MetaRow label="Centro" value={meta.site_name} />}
            {typeof meta.user_name === 'string' && <MetaRow label="Usuario" value={meta.user_name} />}
            {typeof meta.user_email === 'string' && <MetaRow label="Correo" value={meta.user_email} />}
            {typeof meta.admin_message === 'string' && (
              <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Mensaje</p>
                <p className="mt-1 text-sm text-ink">{meta.admin_message}</p>
              </div>
            )}
            {typeof meta.message === 'string' && (
              <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Mensaje</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{meta.message}</p>
              </div>
            )}
            {typeof meta.review_notes === 'string' && (
              <div className="rounded-2xl bg-critical/10 px-3 py-2.5 ring-1 ring-critical/20">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Motivo</p>
                <p className="mt-1 text-sm text-ink">{meta.review_notes}</p>
              </div>
            )}
          </div>
        )}
      </GlassCard>
      <div className="flex flex-col gap-2">
        {notification.action_url && (
          <EmergencyButton variant="primary" size="md" className="w-full" onClick={onAction}>
            {actionLabel}
          </EmergencyButton>
        )}
        <EmergencyButton variant="glass" size="md" className="w-full text-critical" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Eliminar
        </EmergencyButton>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-subtle">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  )
}
