import { motion } from 'framer-motion'
import { BookOpen, FileText, HelpCircle, Map } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { GlassCard } from '@/components/ui/glass-card'
import type { CitizenTab } from '@/data/portal/public-portal-content'

interface CitizenHomeProps {
  onNavigate: (tab: CitizenTab) => void
  onJoinNetwork?: () => void
}

const ACTIONS = [
  { id: 'map' as CitizenTab, icon: Map, label: 'Ver mapa', hint: 'Hospitales, refugios y centros de acopio' },
  { id: 'report' as CitizenTab, icon: FileText, label: 'Reportar una situación', hint: 'Sin necesidad de crear cuenta' },
  { id: 'resources' as CitizenTab, icon: BookOpen, label: 'Recursos útiles', hint: 'Guías, contactos y primeros auxilios' },
  { id: 'guide' as CitizenTab, icon: HelpCircle, label: 'Guía de emergencia', hint: 'Qué hacer ante sismo, inundación o incendio' },
]

export function CitizenHome({ onNavigate, onJoinNetwork }: CitizenHomeProps) {
  return (
    <div className="flex min-h-full flex-col px-4 pt-12 lg:px-8 lg:pt-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="mx-auto flex w-full max-w-lg flex-col items-center text-center"
      >
        <FaroIcon size={56} title="FARO" />
        <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
          ¿Cómo podemos ayudarte hoy?
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-subtle">
          Información confiable para emergencias. Sin registro, sin complicaciones.
        </p>
      </motion.div>

      <div className="mx-auto mt-10 grid w-full max-w-lg gap-3 sm:grid-cols-2">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon
          return (
            <motion.button
              key={action.id}
              type="button"
              onClick={() => onNavigate(action.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: [0.32, 0.72, 0, 1] }}
              whileTap={{ scale: 0.97 }}
              className="group flex flex-col items-start gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 text-left transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.06]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10 text-info ring-1 ring-inset ring-info/20">
                <Icon className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <span className="space-y-1">
                <span className="block text-[17px] font-semibold leading-tight text-ink">{action.label}</span>
                <span className="block text-xs leading-snug text-ink-subtle">{action.hint}</span>
              </span>
            </motion.button>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mx-auto mt-auto w-full max-w-lg pb-6 pt-12 lg:pb-10"
      >
        <GlassCard className="!rounded-2xl !border-white/[0.06] !bg-white/[0.02] !p-4 !shadow-none">
          <p className="text-center text-xs leading-relaxed text-ink-muted">
            Si hay riesgo de vida, llama primero al <span className="font-semibold text-ink">911</span> o a Protección Civil antes de usar FARO.
          </p>
        </GlassCard>

        {onJoinNetwork && (
          <button
            type="button"
            onClick={onJoinNetwork}
            className="mx-auto mt-4 flex items-center gap-2 text-xs text-info transition-colors hover:text-info/80"
          >
            ¿Eres voluntario, gestor o coordinador? Únete a la Red FARO
          </button>
        )}
      </motion.div>
    </div>
  )
}
