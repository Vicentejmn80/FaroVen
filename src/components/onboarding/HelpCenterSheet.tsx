import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileText,
  Mail,
  Shield,
  X,
} from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { HELP_CENTER_TOPICS } from '@/lib/onboarding-content'
import { PriorityCoverageGuide } from '@/components/onboarding/PriorityCoverageGuide'
import { formatBuildVersion } from '@/lib/build-info'
import { cn } from '@/lib/utils'

interface HelpCenterSheetProps {
  open: boolean
  onClose: () => void
}

const LEGAL_LINKS = [
  { doc: 'terms' as const, label: 'Términos de Servicio', icon: FileText },
  { doc: 'privacy' as const, label: 'Política de Privacidad', icon: Shield },
  { doc: 'cookies' as const, label: 'Política de Cookies', icon: FileText },
  { doc: 'notice' as const, label: 'Aviso Legal', icon: FileText },
  { doc: 'contact' as const, label: 'Contacto / Soporte', icon: Mail },
  { doc: 'about' as const, label: 'Acerca de FARO', icon: CircleHelp },
]

/** Centro de ayuda permanente — conceptos clave + legales (móvil). */
export function HelpCenterSheet({ open, onClose }: HelpCenterSheetProps) {
  const [expanded, setExpanded] = useState<string | null>(HELP_CENTER_TOPICS[0]?.id ?? null)
  const version = formatBuildVersion()

  const openLegal = (doc: (typeof LEGAL_LINKS)[number]['doc']) => {
    onClose()
    // Deja cerrar el sheet antes de abrir el documento
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('faro:open-legal', { detail: { doc } }))
    }, 180)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-center-title"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[76] mx-auto w-full max-w-lg px-4 pb-safe lg:inset-0 lg:flex lg:items-center lg:justify-center lg:px-6 lg:pb-0"
          >
            <div className="glass-strong max-h-[85vh] overflow-y-auto rounded-t-[28px] px-5 pb-8 pt-3 shadow-2xl lg:max-h-[min(85vh,720px)] lg:w-full lg:max-w-md lg:rounded-[28px]">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 lg:hidden" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CircleHelp className="h-5 w-5 text-info" />
                  <h2 id="help-center-title" className="text-[18px] font-semibold text-ink">
                    ¿Cómo funciona FARO?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-ink-subtle hover:bg-white/10"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2 text-sm text-ink-muted">
                Respuestas breves sobre los conceptos principales de la plataforma.
              </p>

              <div className="mt-4 space-y-2">
                {HELP_CENTER_TOPICS.map((topic) => {
                  const isOpen = expanded === topic.id
                  return (
                    <div key={topic.id} className="rounded-2xl border border-white/10 bg-white/[0.03]">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : topic.id)}
                        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
                      >
                        <span className="text-sm font-medium text-ink">{topic.question}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-ink-subtle transition-transform',
                            isOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {isOpen && (
                        <p className="border-t border-white/10 px-3.5 pb-3 pt-2 text-sm leading-relaxed text-ink-muted">
                          {topic.answer}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Prioridades y cobertura
                </p>
                <div className="mt-3">
                  <PriorityCoverageGuide compact />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Legal y soporte
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {LEGAL_LINKS.map(({ doc, label, icon: Icon }) => (
                    <button
                      key={doc}
                      type="button"
                      onClick={() => openLegal(doc)}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-left transition-colors hover:border-info/25 hover:bg-info/[0.06]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                        <Icon className="h-4 w-4 text-info" strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-ink-faint" />
                    </button>
                  ))}
                </div>
                {version && (
                  <p className="pt-1 text-center text-[11px] text-ink-faint">Versión {version}</p>
                )}
              </div>

              <EmergencyButton variant="primary" size="lg" className="mt-5 w-full" onClick={onClose}>
                Entendido
              </EmergencyButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
