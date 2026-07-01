import { ClipboardList, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { timeAgo } from '@/lib/utils'
import type { Report } from '@/domain/models'

interface CoordinatorNotificationsSheetProps {
  open: boolean
  reports: Report[]
  onClose: () => void
  onOpenReport: (report: Report) => void
  onOpenInbox: () => void
}

export function CoordinatorNotificationsSheet({
  open,
  reports,
  onClose,
  onOpenReport,
  onOpenInbox,
}: CoordinatorNotificationsSheetProps) {
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
                  <p className="text-base font-semibold text-ink">Reportes por revisar</p>
                  <p className="text-xs text-ink-subtle">
                    {reports.length
                      ? `${reports.length} pendiente${reports.length === 1 ? '' : 's'} en tu centro`
                      : 'Sin reportes pendientes'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-ink-subtle hover:bg-white/10 hover:text-ink"
                  aria-label="Cerrar notificaciones"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {reports.length === 0 ? (
                <p className="rounded-2xl bg-white/[0.04] px-3 py-4 text-sm text-ink-muted">
                  Cuando un ciudadano reporte sobre tu centro, aparecerá aquí y la campanita se
                  activará.
                </p>
              ) : (
                <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                  {reports.map((report) => (
                    <li key={report.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenReport(report)
                          onClose()
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:border-warning/40 hover:bg-white/[0.08]"
                      >
                        <p className="line-clamp-2 text-sm text-ink">{report.description}</p>
                        <p className="mt-1 text-[11px] text-ink-subtle">
                          {timeAgo(report.createdAt)} · Pendiente de revisión
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <EmergencyButton variant="primary" size="md" className="w-full" onClick={onOpenInbox}>
                <ClipboardList className="h-4 w-4" />
                Ir a bandeja de reportes
              </EmergencyButton>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
