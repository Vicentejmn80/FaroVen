import { useState } from 'react'
import { ArrowRight, BookOpen, ChevronRight, Phone, Shield } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EMERGENCY_CONTACTS } from '@/data/guide/emergency-contacts'
import { PORTAL_RESOURCES } from '@/data/portal/public-portal-content'

interface CitizenResourcesProps {
  onJoinNetwork?: () => void
}

type ResourceView = 'menu' | 'emergency-numbers' | 'first-aid' | 'shelter-kit'

export function CitizenResources({ onJoinNetwork }: CitizenResourcesProps) {
  const [view, setView] = useState<ResourceView>('menu')

  if (view === 'emergency-numbers') {
    return (
      <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        <button type="button" onClick={() => setView('menu')} className="flex items-center gap-1 text-sm font-medium text-info transition-colors hover:text-info/80">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Todos los recursos
        </button>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">Números de emergencia</h2>
          <p className="text-sm text-ink-subtle">En una emergencia que ponga en riesgo la vida, llama primero a los servicios oficiales.</p>
        </div>
        <div className="space-y-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={c.id}
              href={`tel:${c.phone.replace(/\s/g, '')}`}
              className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition-colors hover:border-white/[0.12]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-lg">
                  {c.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium text-ink">{c.name}</span>
                  <span className="text-xs text-ink-subtle">{c.description}</span>
                </span>
              </span>
              <span className="font-mono text-sm font-semibold text-info">{c.phone}</span>
            </a>
          ))}
        </div>
        <GlassCard className="!rounded-2xl !border-warning/20 !bg-warning/[0.04] !p-3 !shadow-none">
          <p className="text-xs text-warning">
            FARO complementa la información oficial. Sigue siempre las indicaciones de las autoridades.
          </p>
        </GlassCard>
      </div>
    )
  }

  if (view === 'first-aid') {
    return (
      <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        <button type="button" onClick={() => setView('menu')} className="flex items-center gap-1 text-sm font-medium text-info transition-colors hover:text-info/80">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Todos los recursos
        </button>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">Primeros auxilios</h2>
          <p className="text-sm text-ink-subtle">Guía rápida para actuar ante situaciones comunes mientras llega la ayuda profesional.</p>
        </div>
        <div className="space-y-2">
          <GuideCard
            title="Heridas leves"
            steps={['Lava la herida con agua limpia y jabón', 'Aplica presión con una gasa para detener sangrado', 'Cubre con vendaje limpio', 'Si el sangrado no cesa en 10 minutos, busca atención médica']}
          />
          <GuideCard
            title="Quemaduras"
            steps={['Enfría la zona con agua corriente (no hielo directo) por 10-15 min', 'No apliques cremas, mantequilla ni hielo directo', 'Cubre con un paño limpio o gasa húmeda', 'Si es grado 2 o más, acude a un centro de salud']}
          />
          <GuideCard
            title="Fracturas y esguinces"
            steps={['Inmoviliza la zona sin intentar recolocar', 'Aplica hielo envuelto en un paño (nunca directo)', 'No cargues peso ni forces el movimiento', 'Traslada a un centro de salud lo antes posible']}
          />
          <GuideCard
            title="Deshidratación"
            steps={['Traslada a la persona a un lugar fresco y sombreado', 'Ofrece agua en pequeños sorbos (no de golpe)', 'Si hay mareo, acuesta a la persona con piernas elevadas', 'Si no mejora en 30 minutos, busca atención médica']}
          />
        </div>
      </div>
    )
  }

  if (view === 'shelter-kit') {
    return (
      <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        <button type="button" onClick={() => setView('menu')} className="flex items-center gap-1 text-sm font-medium text-info transition-colors hover:text-info/80">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Todos los recursos
        </button>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">Qué llevar a un refugio</h2>
          <p className="text-sm text-ink-subtle">Lista de elementos básicos recomendados si necesitas ir a un refugio temporal.</p>
        </div>
        <div className="space-y-2">
          <KitSection title="Documentos" items={['Identificación oficial (Cédula, pasaporte)', 'Certificados médicos y recetas', 'Escrituras o contrato de vivienda (si aplica)', 'Dinero en efectivo']} />
          <KitSection title="Hidratación y alimentos" items={['Agua embotellada (2 litros por persona/día)', 'Alimentos no perecederos (enlatados, barras)', 'Abrelatas manual', 'Leche infantil y pañales si hay bebés']} />
          <KitSection title="Salud e higiene" items={['Botiquín básico (gasas, vendas, alcohol, curitas)', 'Medicamentos recetados para al menos 7 días', 'Cepillo y pasta dental, jabón, toallas', 'Gel antibacterial, mascarillas']} />
          <KitSection title="Ropa y abrigo" items={['Ropa cómoda y de cambio', 'Chamarras o cobijas', 'Zapatos cerrados y resistentes', 'Ropa impermeable']} />
          <KitSection title="Comunicación" items={['Cargador portátil (power bank) para teléfono', 'Radio con pilas', 'Linterna con pilas extra', 'Silbato para señalar tu ubicación']} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Recursos útiles</h2>
        <p className="text-sm text-ink-subtle">Información práctica para orientarte durante una emergencia.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CategoryCard
          icon={Phone}
          title="Números de emergencia"
          description="911, ambulancias, bomberos y más"
          onClick={() => setView('emergency-numbers')}
        />
        <CategoryCard
          icon={BookOpen}
          title="Primeros auxilios"
          description="Guía rápida para situaciones comunes"
          onClick={() => setView('first-aid')}
        />
        <CategoryCard
          icon={Shield}
          title="Qué llevar a un refugio"
          description="Lista útil de elementos básicos"
          onClick={() => setView('shelter-kit')}
        />
        {onJoinNetwork && (
          <CategoryCard
            icon={ArrowRight}
            title="Cómo ofrecer ayuda"
            description="Únete a la Red de Apoyo FARO"
            onClick={onJoinNetwork}
          />
        )}
      </div>

      {PORTAL_RESOURCES.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-ink-subtle">También disponible</h3>
          {PORTAL_RESOURCES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/[0.12]"
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{item.title}</span>
                <span className="text-xs text-ink-subtle">{item.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Phone
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/10 text-info ring-1 ring-inset ring-info/20">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="space-y-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-subtle">{description}</span>
      </span>
    </button>
  )
}

function GuideCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <GlassCard className="!rounded-2xl !border-white/[0.06] !p-4 !shadow-none">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ol className="mt-2 space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-ink-subtle">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-info/10 text-[10px] font-semibold text-info">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </GlassCard>
  )
}

function KitSection({ title, items }: { title: string; items: string[] }) {
  return (
    <GlassCard className="!rounded-2xl !border-white/[0.06] !p-4 !shadow-none">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-ink-subtle">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-info" />
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
