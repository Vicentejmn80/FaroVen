import { ClipboardPlus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'

interface CreateCaseHintSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

/** Confirmación elegante antes de crear un caso manual (FAB +). */
export function CreateCaseHintSheet({ open, onClose, onConfirm }: CreateCaseHintSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] lg:absolute"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-case-hint-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-4 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-[70] mx-auto max-w-md lg:absolute lg:inset-x-auto lg:bottom-24 lg:left-1/2 lg:w-full lg:max-w-sm lg:-translate-x-1/2"
          >
            <GlassCard className="!rounded-2xl !border-info/25 !bg-[#0c1528]/96 !p-4 !shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info/15 text-info">
                    <ClipboardPlus className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <p
                      id="create-case-hint-title"
                      className="text-sm font-semibold text-ink"
                    >
                      Crear caso manual
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      Usa esto cuando recibas una solicitud por teléfono, WhatsApp o en persona.
                      El caso entra en <span className="text-ink">Nuevo</span> del pipeline de
                      Operaciones.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-ink-faint hover:bg-white/[0.06] hover:text-ink"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={onClose}>
                  Cancelar
                </EmergencyButton>
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    onClose()
                    onConfirm()
                  }}
                >
                  Continuar
                </EmergencyButton>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
