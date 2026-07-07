import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { INITIAL_ONBOARDING_STEPS } from '@/lib/onboarding-content'
import { PriorityCoverageGuide } from '@/components/onboarding/PriorityCoverageGuide'

interface InitialOnboardingFlowProps {
  open: boolean
  onComplete: () => void
}

/** Onboarding inicial de 4 pasos — solo la primera vez. */
export function InitialOnboardingFlow({ open, onComplete }: InitialOnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const current = INITIAL_ONBOARDING_STEPS[step]
  const isLast = step === INITIAL_ONBOARDING_STEPS.length - 1

  const goNext = () => {
    if (isLast) {
      onComplete()
      return
    }
    setStep((s) => s + 1)
  }

  const goBack = () => setStep((s) => Math.max(0, s - 1))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-lg px-4 pb-safe"
          >
            <div className="glass-strong max-h-[85vh] overflow-y-auto rounded-t-[28px] px-6 pb-8 pt-3 shadow-2xl shadow-black/40">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

              <div className="flex items-center gap-3">
                <FaroIcon size={40} title="FARO" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
                    Paso {step + 1} de {INITIAL_ONBOARDING_STEPS.length}
                  </p>
                  <h2 id="onboarding-title" className="text-[20px] font-semibold tracking-tight text-ink">
                    {current.title}
                  </h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-ink-muted">{current.body}</p>

              {'bullets' in current && current.bullets && (
                <ul className="mt-3 space-y-2">
                  {current.bullets.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-ink-subtle">
                      <span className="text-info">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {'showPriorityGuide' in current && current.showPriorityGuide && (
                <div className="mt-4">
                  <PriorityCoverageGuide compact />
                </div>
              )}

              {'footnote' in current && current.footnote && (
                <p className="mt-4 text-xs leading-relaxed text-ink-faint">{current.footnote}</p>
              )}

              <div className="mt-5 flex gap-1.5">
                {INITIAL_ONBOARDING_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === step
                        ? 'h-1 flex-1 rounded-full bg-info'
                        : 'h-1 flex-1 rounded-full bg-white/15'
                    }
                  />
                ))}
              </div>

              <div className="mt-6 flex gap-2">
                {step > 0 && (
                  <EmergencyButton variant="glass" size="lg" className="flex-1" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4" /> Atrás
                  </EmergencyButton>
                )}
                <EmergencyButton variant="primary" size="lg" className="flex-1" onClick={goNext}>
                  {isLast ? 'Comenzar' : 'Siguiente'}
                  {!isLast && <ChevronRight className="h-4 w-4" />}
                </EmergencyButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
