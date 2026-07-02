import { AnimatePresence, motion } from 'framer-motion'
import { EmergencyButton } from '@/components/ui/emergency-button'

interface WelcomeSheetProps {
  open: boolean
  onComplete: () => void
}

const HIGHLIGHTS = [
  { emoji: '🏥', text: 'Consultar hospitales, refugios y centros de acopio.' },
  { emoji: '📦', text: 'Ver necesidades actualizadas.' },
  { emoji: '🆘', text: 'Reportar información desde el terreno.' },
  { emoji: '📍', text: 'Navegar directamente hacia los centros.' },
] as const

export function WelcomeSheet({ open, onComplete }: WelcomeSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-sheet-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-lg px-4 pb-safe"
          >
            <div className="glass-strong rounded-t-[28px] px-6 pb-8 pt-3 shadow-2xl shadow-black/40">
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

              <h2 id="welcome-sheet-title" className="text-[22px] font-semibold tracking-tight text-ink">
                Bienvenido a FARO
              </h2>
              <p className="mt-2 text-sm text-ink-muted">Aquí podrás:</p>

              <ul className="mt-5 space-y-3.5">
                {HIGHLIGHTS.map((item) => (
                  <li key={item.text} className="flex items-start gap-3 text-[15px] leading-snug text-ink">
                    <span className="text-lg leading-none" aria-hidden>
                      {item.emoji}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-ink-subtle">
                Toda la información indica quién la actualizó y cuándo fue verificada por última vez.
              </p>

              <EmergencyButton variant="primary" size="lg" className="mt-6 w-full" onClick={onComplete}>
                Comenzar
              </EmergencyButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
