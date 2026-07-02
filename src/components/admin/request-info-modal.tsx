import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquare, Send, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { textareaClassName } from '@/components/faro/flow-sheet'

const DEFAULT_HINT =
  'Hola, revisamos tu solicitud para coordinar un centro en FARO. ¿Podrías ampliar tu experiencia en el centro y confirmar tu rol actual?'

interface RequestInfoModalProps {
  open: boolean
  applicantName: string
  applicantEmail: string
  busy?: boolean
  onClose: () => void
  onSend: (message: string) => Promise<void>
}

export function RequestInfoModal({
  open,
  applicantName,
  applicantEmail,
  busy,
  onClose,
  onSend,
}: RequestInfoModalProps) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setMessage('')
      setError(null)
    }
  }, [open, applicantEmail])

  const trimmed = message.trim()
  const canSend = trimmed.length >= 10 && !busy

  async function handleSend() {
    if (!canSend) return
    setError(null)
    try {
      await onSend(trimmed)
      onClose()
    } catch {
      setError('No se pudo enviar el mensaje. Inténtalo nuevamente.')
    }
  }

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
            className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-info-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-4 top-[12vh] z-[71] mx-auto w-full max-w-md sm:inset-x-auto"
          >
            <GlassCard strong className="space-y-4 shadow-2xl shadow-black/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-info/15 ring-1 ring-info/25">
                    <MessageSquare className="h-5 w-5 text-info" />
                  </span>
                  <div>
                    <h2 id="request-info-title" className="text-[17px] font-semibold text-ink">
                      Solicitar más información
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      El solicitante recibirá una notificación en FARO.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-white/10 hover:text-ink"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5 text-sm">
                <p className="font-medium text-ink">{applicantName}</p>
                <p className="text-ink-subtle">{applicantEmail}</p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Tu mensaje
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder={DEFAULT_HINT}
                  className={textareaClassName}
                  autoFocus
                />
                <p className="text-[11px] text-ink-faint">Mínimo 10 caracteres.</p>
              </label>

              {error && (
                <p className="rounded-xl border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                  {error}
                </p>
              )}

              <EmergencyButton
                variant="primary"
                size="md"
                className="w-full"
                disabled={!canSend}
                onClick={() => void handleSend()}
              >
                <Send className="h-4 w-4" /> {busy ? 'Enviando…' : 'Enviar'}
              </EmergencyButton>

              <EmergencyButton variant="ghost" size="md" className="w-full" onClick={onClose}>
                Cancelar
              </EmergencyButton>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
