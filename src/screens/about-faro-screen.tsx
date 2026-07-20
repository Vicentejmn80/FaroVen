import { ArrowDown, ExternalLink, Users } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { SectionTitle } from '@/components/faro/section-title'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { ABOUT_FARO_SECTIONS } from '@/data/legal/documents'

interface AboutFaroScreenProps {
  onBack?: () => void
}

const FLOW_STEPS = [
  'Ciudadanos y voluntarios reportan información.',
  'Coordinadores verifican y actualizan estados.',
  'Organizaciones ejecutan la respuesta.',
  'FARO consolida y muestra el panorama en el mapa.',
]

export function AboutFaroScreen({ onBack }: AboutFaroScreenProps) {
  return (
    <ScreenScaffold title={ABOUT_FARO_SECTIONS.title} subtitle={ABOUT_FARO_SECTIONS.subtitle} onBack={onBack}>
      <div className="space-y-5 pt-2">
        {ABOUT_FARO_SECTIONS.sections.map((section) => (
          <GlassCard key={section.id} className="space-y-2">
            <p className="text-[15px] font-semibold text-ink">{section.title}</p>
            <p className="text-sm leading-relaxed text-ink-muted">{section.body}</p>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </GlassCard>
        ))}

        <section className="space-y-3">
          <SectionTitle>Flujo de coordinación</SectionTitle>
          <GlassCard className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/15 text-info">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Diagrama simple</p>
                <p className="text-xs text-ink-subtle">
                  Un resumen del ciclo operativo de FARO durante una emergencia.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {FLOW_STEPS.map((step, index) => (
                <div key={step} className="space-y-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink-muted">
                    {step}
                  </div>
                  {index < FLOW_STEPS.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowDown className="h-4 w-4 text-ink-faint" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <GlassCard className="space-y-3">
          <p className="text-sm font-medium text-ink">Documentos legales</p>
          <p className="text-sm text-ink-muted">
            Conoce tus derechos y obligaciones al usar FARO.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['terms', 'Términos de Servicio'],
                ['privacy', 'Política de Privacidad'],
                ['cookies', 'Política de Cookies'],
                ['notice', 'Aviso Legal'],
              ] as const
            ).map(([doc, label]) => (
              <EmergencyButton
                key={doc}
                variant="glass"
                size="sm"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('faro:open-legal', { detail: { doc } }))
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {label}
              </EmergencyButton>
            ))}
          </div>
        </GlassCard>
      </div>
    </ScreenScaffold>
  )
}
