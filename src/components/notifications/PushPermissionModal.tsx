import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, ShieldCheck, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'

interface PushPermissionModalProps {
  open: boolean
  loading?: boolean
  onAccept: () => void
  onDismiss: () => void
}

/** Modal explicativo — solo se muestra cuando el usuario elige activar push. */
export function PushPermissionModal({ open, loading, onAccept, onDismiss }: PushPermissionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/15">
                  <BellRing className="h-5 w-5 text-info" />
                </span>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-full p-1.5 text-ink-subtle hover:bg-white/10 hover:text-ink"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-base font-semibold text-ink">Alertas en tu dispositivo</p>
                <p className="text-sm leading-relaxed text-ink-muted">
                  FARO puede avisarte cuando haya solicitudes urgentes, reportes en tu centro o decisiones sobre tu
                  cuenta — incluso si no tienes la app abierta.
                </p>
                <ul className="space-y-1.5 text-sm text-ink-subtle">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-operational" />
                    Solo recibirás alertas relevantes para tu rol
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-operational" />
                    Puedes silenciarlas o desactivarlas en Preferencias
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <EmergencyButton variant="glass" size="md" className="flex-1" onClick={onDismiss}>
                  Ahora no
                </EmergencyButton>
                <EmergencyButton variant="primary" size="md" className="flex-1" onClick={onAccept} disabled={loading}>
                  {loading ? 'Activando…' : 'Activar alertas'}
                </EmergencyButton>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
