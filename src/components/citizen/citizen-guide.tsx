import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EMERGENCY_CONTACTS } from '@/data/guide/emergency-contacts'

type GuideView = 'menu' | 'earthquake' | 'flood' | 'fire' | 'first-aid' | 'kit' | 'numbers'

export function CitizenGuide() {
  const [view, setView] = useState<GuideView>('menu')

  if (view === 'numbers') {
    return (
      <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        <button type="button" onClick={() => setView('menu')} className="flex items-center gap-1 text-sm font-medium text-info transition-colors hover:text-info/80">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Guía de emergencia
        </button>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">Números importantes</h2>
          <p className="text-sm text-ink-subtle">Líneas de emergencia oficiales en Venezuela.</p>
        </div>
        <div className="space-y-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={c.id}
              href={`tel:${c.phone.replace(/\s/g, '')}`}
              className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition-colors hover:border-white/[0.12]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-critical/10 text-lg">
                  {c.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium text-ink">{c.name}</span>
                  <span className="text-xs text-ink-subtle">{c.description}</span>
                </span>
              </span>
              <span className="font-mono text-sm font-semibold text-critical">{c.phone}</span>
            </a>
          ))}
        </div>
      </div>
    )
  }

  if (view !== 'menu') {
    const content = GUIDE_CONTENT[view]
    return (
      <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        <button type="button" onClick={() => setView('menu')} className="flex items-center gap-1 text-sm font-medium text-info transition-colors hover:text-info/80">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Guía de emergencia
        </button>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">{content.title}</h2>
          <p className="text-sm text-ink-subtle">{content.subtitle}</p>
        </div>
        <div className="space-y-2">
          {content.steps.map((step, i) => (
            <GlassCard key={i} className="!rounded-2xl !border-white/[0.06] !p-4 !shadow-none">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info/10 text-xs font-semibold text-info">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{step.title}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{step.description}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
        {content.warning && (
          <GlassCard className="!rounded-2xl !border-critical/20 !bg-critical/[0.04] !p-3 !shadow-none">
            <p className="text-xs text-critical">{content.warning}</p>
          </GlassCard>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Guía de emergencia</h2>
        <p className="text-sm text-ink-subtle">Preparación y acción ante distintas emergencias.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <GuideCard
          emoji="🌍"
          title="Sismo"
          description="Qué hacer durante y después de un terremoto"
          tone="critical"
          onClick={() => setView('earthquake')}
        />
        <GuideCard
          emoji="🌊"
          title="Inundación"
          description="Preparación y acción ante inundaciones"
          tone="warning"
          onClick={() => setView('flood')}
        />
        <GuideCard
          emoji="🔥"
          title="Incendio"
          description="Protocolo de evacuación y seguridad"
          tone="critical"
          onClick={() => setView('fire')}
        />
        <GuideCard
          emoji="🩹"
          title="Primeros auxilios"
          description="Pasos básicos para atención inmediata"
          tone="info"
          onClick={() => setView('first-aid')}
        />
        <GuideCard
          emoji="🎒"
          title="Kit de emergencia"
          description="Elementos esenciales para tener listos"
          tone="info"
          onClick={() => setView('kit')}
        />
        <GuideCard
          emoji="☎️"
          title="Números importantes"
          description="Contactos de emergencia nacionales"
          tone="critical"
          onClick={() => setView('numbers')}
        />
      </div>

      <GlassCard className="!rounded-2xl !border-warning/20 !bg-warning/[0.04] !p-3 !shadow-none">
        <p className="text-xs text-warning">
          Esta guía contiene recomendaciones generales. Sigue siempre las instrucciones de las autoridades locales y de protección civil.
        </p>
      </GlassCard>
    </div>
  )
}

function GuideCard({
  emoji,
  title,
  description,
  tone,
  onClick,
}: {
  emoji: string
  title: string
  description: string
  tone: 'critical' | 'warning' | 'info'
  onClick: () => void
}) {
  const borderClass = tone === 'critical' ? 'hover:border-critical/30' : tone === 'warning' ? 'hover:border-warning/30' : 'hover:border-info/30'
  const badgeClass = tone === 'critical' ? 'bg-critical/10 text-critical' : tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 text-left transition-all ${borderClass} hover:bg-white/[0.06]`}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{emoji}</span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
          {tone === 'critical' ? 'Precaución' : tone === 'warning' ? 'Prevención' : 'Información'}
        </span>
      </div>
      <span className="space-y-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-subtle">{description}</span>
      </span>
    </button>
  )
}

interface GuideStep {
  title: string
  description: string
}

interface GuideContent {
  title: string
  subtitle: string
  steps: GuideStep[]
  warning?: string
}

const GUIDE_CONTENT: Record<string, GuideContent> = {
  earthquake: {
    title: 'Sismo',
    subtitle: 'Qué hacer durante y después de un terremoto',
    steps: [
      { title: 'Mantén la calma', description: 'Respira profundo. Evalúa tu entorno antes de actuar. El pánico causa más accidentes que el sismo.' },
      { title: 'Agáchate, cúbrete y sujétate', description: 'Colócate debajo de una mesa o escritorio resistente. Sujeta la posición hasta que deje de temblar.' },
      { title: 'Aléjate de ventanas', description: 'Evita vidrios, espejos, lámparas y objetos que puedan caer. Busca esquinas interiores si no hay mueble.' },
      { title: 'No uses ascensores', description: 'Usa siempre las escaleras. Si estás en un edificio alto, quédate en tu piso hasta que el sismo termine.' },
      { title: 'Después del sismo', description: 'Revisa si hay fugas de gas, agua o daños estructurales. Sal ordenadamente si el edificio parece inseguro.' },
      { title: 'Prepara una mochila de emergencia', description: 'Agua, alimentos no perecederos, linterna, radio, pilas, botiquín, documentos importantes y silbato.' },
    ],
    warning: 'Si estás en la costa y el sismo fue fuerte, evacúa a zona alta inmediatamente — podría ocurrir un tsunami.',
  },
  flood: {
    title: 'Inundación',
    subtitle: 'Preparación y acción ante inundaciones',
    steps: [
      { title: 'Identifica zonas seguras', description: 'Conoce las rutas de evacuación y los refugios temporales de tu comunidad antes de que ocurra la emergencia.' },
      { title: 'Sube objetos de valor', description: 'Coloca documentos, electrodomésticos y objetos importantes en pisos altos o estantes elevados.' },
      { title: 'Corta suministros', description: 'Si el agua comienza a entrar, corta la electricidad y el gas desde el interruptor principal.' },
      { title: 'No camines en agua corriente', description: 'Solo 15 cm de agua en movimiento pueden derribarte. 30 cm pueden arrastrar un vehículo.' },
      { title: 'Dirígete a zonas altas', description: 'Evacúa hacia terrenos elevados o pisos superiores. No cruces puentes sobre ríos crecidos.' },
      { title: 'Espera instrucciones', description: 'Permanece en lugar seguro hasta que las autoridades indiquen que es seguro regresar.' },
    ],
    warning: 'El agua de inundación puede contener aguas residuales, químicos y objetos peligrosos. No nades ni bebas el agua.',
  },
  fire: {
    title: 'Incendio',
    subtitle: 'Protocolo de evacuación y seguridad',
    steps: [
      { title: 'Mantén la calma y avisa', description: 'Da la voz de alerta inmediatamente. Llama a los bomberos (171) tan pronto estés en un lugar seguro.' },
      { title: 'Sal del lugar', description: 'Abandona el edificio lo más rápido posible. No uses ascensores. No te detengas a recoger objetos.' },
      { title: 'Gatea si hay humo', description: 'El humo y los gases tóxicos suben. Gatea cerca del piso donde el aire es más respirable.' },
      { title: 'Toca las puertas antes de abrir', description: 'Si una puerta está caliente, no la abras. Busca otra salida. El fuego podría estar al otro lado.' },
      { title: 'Cubre tu nariz y boca', description: 'Usa un paño húmedo para cubrir tu rostro y filtrar el humo mientras evacuas.' },
      { title: 'No vuelvas a entrar', description: 'Una vez fuera, no regreses por ninguna razón. Espera a los bomberos en un lugar seguro.' },
    ],
    warning: 'Si tu ropa se incendia: DETENTE, ÉCHATE al suelo y RUEDA para apagar las llamas. No corras — el oxígeno aviva el fuego.',
  },
  'first-aid': {
    title: 'Primeros auxilios',
    subtitle: 'Pasos básicos para atención inmediata',
    steps: [
      { title: 'Evalúa la escena', description: 'Antes de ayudar, asegúrate de que la escena sea segura para ti y la víctima. No te expongas al peligro.' },
      { title: 'Llama por ayuda', description: 'Si la persona está inconsciente o la situación es grave, llama al 911 o 171 antes de intervenir.' },
      { title: 'Revisa respiración', description: 'Verifica si la persona respira. Inclina su cabeza hacia atrás y levanta el mentón para abrir la vía aérea.' },
      { title: 'Controla sangrados', description: 'Aplica presión directa sobre la herida con una gasa o paño limpio. Eleva el área afectada si es posible.' },
      { title: 'No muevas a la persona', description: 'Si hay posibilidad de lesión en columna (caída, golpe fuerte), no muevas a la víctima. Espera ayuda profesional.' },
      { title: 'Mantén a la persona abrigada', description: 'Cubre con una manta o chaqueta para prevenir hipotermia. Habla calmadamente para mantenerla consciente.' },
    ],
    warning: 'RCP (Reanimación Cardiopulmonar): 30 compresiones torácicas firmes y rápidas (a 100-120 por minuto) seguidas de 2 respiraciones de rescate. Repite hasta que llegue ayuda.',
  },
  kit: {
    title: 'Kit de emergencia',
    subtitle: 'Elementos esenciales para tener listos',
    steps: [
      { title: 'Agua y alimentos', description: '2 litros de agua por persona al día para 3-7 días. Alimentos no perecederos como enlatados, barras energéticas, frutos secos.' },
      { title: 'Botiquín básico', description: 'Gasas, vendas, alcohol, curitas, analgésicos, antidiarreicos, medicamentos recetados (mínimo 7 días), mascarillas.' },
      { title: 'Documentos importantes', description: 'Cédula, pasaporte, actas de nacimiento, títulos de propiedad, pólizas de seguro — en bolsa impermeable o digital.' },
      { title: 'Iluminación y comunicación', description: 'Linterna con pilas extra, radio AM/FM de pilas, silbato, cargador portátil (power bank), lista de contactos de emergencia.' },
      { title: 'Ropa y abrigo', description: 'Ropa de cambio, chaqueta impermeable, cobija térmica (manta de supervivencia), zapatos resistentes, ropa interior extra.' },
      { title: 'Necesidades especiales', description: 'Leche infantil, pañales, fórmula médica, gafas, audífonos, bastón, silla de ruedas, comida para mascotas si aplica.' },
    ],
    warning: 'Revisa tu kit cada 6 meses. Rotúa los alimentos y agua antes de que expiren. Ajusta según las necesidades de tu familia.',
  },
}
