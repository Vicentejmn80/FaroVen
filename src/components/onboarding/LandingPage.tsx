import { MapPin } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { FaroIcon } from '@/components/brand/faro-icon'

interface LandingPageProps {
  onEnter: () => void
}

const STEPS = [
  {
    step: '1',
    title: 'Consulta necesidades reales',
    description: 'Hospitales, refugios y centros de acopio con información verificada.',
  },
  {
    step: '2',
    title: 'Lleva ayuda donde realmente hace falta',
    description: 'Prioriza recursos según lo que cada centro reporta en el mapa.',
  },
  {
    step: '3',
    title: 'Los coordinadores mantienen la información actualizada',
    description: 'Cada dato indica quién lo actualizó y cuándo fue verificado.',
  },
] as const

function FaroLogo() {
  return <FaroIcon size={52} title="FARO" />
}

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="faro-canvas flex min-h-screen w-full items-center justify-center bg-[#050A14] px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <FaroLogo />

        <h1 className="mt-8 text-[34px] font-semibold tracking-tight text-ink">FARO</h1>
        <p className="mt-3 max-w-[28ch] text-[17px] leading-relaxed text-ink-muted">
          Información verificada para coordinar ayuda durante emergencias.
        </p>

        <EmergencyButton variant="primary" size="lg" className="mt-10 w-full" onClick={onEnter}>
          <MapPin className="h-5 w-5" />
          Entrar al mapa
        </EmergencyButton>

        <section className="mt-14 w-full space-y-6 text-left">
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            ¿Cómo funciona?
          </h2>
          {STEPS.map((item) => (
            <div key={item.step} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-info">
                {item.step}
              </span>
              <div>
                <p className="text-[15px] font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-subtle">{item.description}</p>
              </div>
            </div>
          ))}
        </section>

        <p className="mt-12 text-xs leading-relaxed text-ink-faint">
          FARO complementa la información oficial. Sigue siempre las indicaciones de las autoridades
          competentes.
        </p>
      </div>
    </div>
  )
}
