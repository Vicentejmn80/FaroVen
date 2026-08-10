import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeartHandshake, Route, Clock3 } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    id: 'welcome',
    icon: HeartHandshake,
    title: 'Bienvenido a la Red FARO',
    description: 'Coordinamos ayuda humanitaria en tu comunidad, con información confiable.',
  },
  {
    id: 'how',
    icon: Route,
    title: 'Así funciona la red',
    description: 'Se reporta una necesidad, alguien responde, y el caso se verifica y cierra.',
  },
  {
    id: 'commitment',
    icon: Clock3,
    title: 'Participa a tu ritmo',
    description: 'Elige cuánto ayudar. Hay turnos flexibles; tu tiempo siempre cuenta.',
  },
] as const

interface RegistrationOnboardingProps {
  onComplete: () => void
}

/**
 * Mini onboarding post-registro (2–3 pasos) antes de la selección de rol.
 * No usa position:fixed; vive en el flujo normal de la pantalla.
 */
export function RegistrationOnboarding({ onComplete }: RegistrationOnboardingProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0B1626] text-[#F2F6FA]">
      <div className="relative flex shrink-0 items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] lg:px-8">
        <div className="flex items-center gap-2.5">
          <FaroIcon size={36} title="FARO" />
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7690AC]">
            Red de Apoyo
          </p>
        </div>
        <button
          type="button"
          onClick={onComplete}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#7690AC] transition-colors hover:text-[#F2F6FA]"
        >
          Omitir
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-md flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="rounded-[20px] border border-[#1C2B40] bg-[#12233A] px-6 py-10 text-center sm:px-8"
            >
              <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2DD4BF]/12 text-[#2DD4BF] ring-1 ring-inset ring-[#2DD4BF]/25">
                <Icon className="h-8 w-8" strokeWidth={1.5} />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-[#F2F6FA] sm:text-2xl">
                {current.title}
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#8CA0B8]">
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-center gap-2" aria-label="Progreso">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i === step ? 'bg-[#2DD4BF]' : 'bg-[#223652]',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#1C2B40] bg-[#0B1626]/95 px-4 pt-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-md">
          <EmergencyButton
            variant="primary"
            size="lg"
            className="w-full !bg-[#2DD4BF] !text-[#0B1626] !shadow-none"
            onClick={() => {
              if (isLast) onComplete()
              else setStep((s) => s + 1)
            }}
          >
            {isLast ? 'Comenzar' : 'Siguiente'}
          </EmergencyButton>
        </div>
      </div>
    </div>
  )
}
