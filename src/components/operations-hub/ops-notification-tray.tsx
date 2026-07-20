import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, CheckCheck, ChevronRight } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo } from '@/lib/utils'

interface OpsNotification {
  id: string
  title: string
  message: string
  type: 'new_case' | 'update' | 'assignment' | 'alert' | 'system'
  read: boolean
  caseId?: string
  createdAt: Date
}

interface OpsNotificationTrayProps {
  notifications: OpsNotification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onOpenCase?: (caseId: string) => void
  className?: string
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  new_case: { label: 'Nuevo caso', color: 'text-info' },
  update: { label: 'Actualización', color: 'text-operational' },
  assignment: { label: 'Asignación', color: 'text-warning' },
  alert: { label: 'Alerta', color: 'text-critical' },
  system: { label: 'Sistema', color: 'text-ink-muted' },
}

export function OpsNotificationTray({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onOpenCase,
  className,
}: OpsNotificationTrayProps) {
  const [open, setOpen] = useState(false)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
          open || unread > 0
            ? 'border-info/30 bg-info/10 text-info'
            : 'border-white/[0.06] text-ink-muted hover:text-ink-subtle',
        )}
      >
        {unread > 0 ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-critical text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        Notificaciones
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-80 origin-top-right"
          >
            <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0F1828]/95 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                <p className="text-xs font-semibold text-ink">Centro de notificaciones</p>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="flex items-center gap-1 text-[11px] text-info transition-colors hover:text-info/80"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Leer todas
                  </button>
                )}
              </div>
              <ScrollArea className="max-h-80">
                {notifications.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-ink-muted">
                    No hay notificaciones
                  </div>
                ) : (
                  <div className="space-y-0.5 px-1 py-1">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          onMarkRead(n.id)
                          if (n.caseId && onOpenCase) onOpenCase(n.caseId)
                        }}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]',
                          !n.read && 'bg-info/[0.03]',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-info" />}
                            <span
                              className={cn(
                                'text-[11px] font-medium',
                                TYPE_META[n.type]?.color ?? 'text-ink-muted',
                              )}
                            >
                              {TYPE_META[n.type]?.label ?? n.type}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-ink">{n.title}</p>
                          <p className="mt-0.5 text-[11px] text-ink-muted line-clamp-2">{n.message}</p>
                          <p className="mt-0.5 text-[10px] text-ink-faint">{timeAgo(n.createdAt)}</p>
                        </div>
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
