import { motion } from 'framer-motion'
import { BookOpen, FileText, HelpCircle, Map } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { GlassCard } from '@/components/ui/glass-card'
import type { CitizenTab } from '@/data/portal/public-portal-content'
import { cn } from '@/lib/utils'

interface CitizenHomeProps {
  onNavigate: (tab: CitizenTab) => void
  onJoinNetwork?: () => void
}

const SECONDARY_ACTIONS = [
  {
    id: 'map' as CitizenTab,
    icon: Map,
    label: 'Ver mapa',
    hint: 'Hospitales, refugios y centros',
  },
  {
    id: 'resources' as CitizenTab,
    icon: BookOpen,
    label: 'Recursos útiles',
    hint: 'Guías y contactos',
  },
  {
    id: 'guide' as CitizenTab,
    icon: HelpCircle,
    label: 'Guía de emergencia',
    hint: 'Qué hacer ante una crisis',
  },
]

/** Preview estático liviano — no carga Leaflet ni tiles. */
function MapThumbnail({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[#1C2B40] bg-[#0B1626]',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 160 72" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="map-sea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#12233A" />
            <stop offset="100%" stopColor="#0B1626" />
          </linearGradient>
        </defs>
        <rect width="160" height="72" fill="url(#map-sea)" />
        {/* Costas / calles simuladas */}
        <path
          d="M0 48 Q40 36 80 44 T160 32"
          fill="none"
          stroke="#223652"
          strokeWidth="1.5"
        />
        <path
          d="M12 12 L48 28 L90 18 L140 40"
          fill="none"
          stroke="#1C2B40"
          strokeWidth="1"
        />
        <path d="M20 60 L70 50 L110 58 L150 46" fill="none" stroke="#1C2B40" strokeWidth="1" />
        {/* Puntos de referencia */}
        <circle cx="42" cy="28" r="3.5" fill="#2DD4BF" />
        <circle cx="42" cy="28" r="7" fill="#2DD4BF" fillOpacity="0.2" />
        <circle cx="98" cy="22" r="3" fill="#5FE0B7" />
        <circle cx="98" cy="22" r="6" fill="#5FE0B7" fillOpacity="0.18" />
        <circle cx="128" cy="48" r="3" fill="#F5A05A" />
        <circle cx="128" cy="48" r="6" fill="#F5A05A" fillOpacity="0.2" />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#12233A]/80 via-transparent to-transparent" />
    </div>
  )
}

export function CitizenHome({ onNavigate, onJoinNetwork }: CitizenHomeProps) {
  return (
    <div className="flex min-h-full flex-col px-4 pt-8 pb-6 lg:px-8 lg:pt-16 lg:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="mx-auto flex w-full max-w-lg flex-col items-center text-center"
      >
        <FaroIcon size={56} title="FARO" />
        <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight text-[#F2F6FA] sm:text-[32px]">
          ¿Cómo podemos ayudarte hoy?
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8CA0B8]">
          Información confiable para emergencias. Sin registro, sin complicaciones.
        </p>
      </motion.div>

      <div className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-3">
        {/* Acción principal: Reportar */}
        <motion.button
          type="button"
          onClick={() => onNavigate('report')}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: [0.32, 0.72, 0, 1] }}
          whileTap={{ scale: 0.985 }}
          className={cn(
            'group flex w-full items-start gap-4 rounded-3xl border p-5 text-left transition-colors duration-200',
            'border-[#2DD4BF] bg-[#0F2A2E] hover:bg-[#12353A]',
          )}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2DD4BF]/15 text-[#2DD4BF] ring-1 ring-inset ring-[#2DD4BF]/35">
            <FileText className="h-7 w-7" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <span className="block text-[19px] font-semibold leading-tight text-[#F2F6FA]">
              Reportar una situación
            </span>
            <span className="block text-sm leading-snug text-[#8CA0B8]">
              Cuéntanos qué pasa cerca de ti. Sin necesidad de crear cuenta.
            </span>
            <span className="inline-flex pt-1 text-xs font-medium text-[#2DD4BF]">
              Empezar reporte →
            </span>
          </span>
        </motion.button>

        {/* Acciones secundarias compactas */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          {SECONDARY_ACTIONS.map((action, i) => {
            const Icon = action.icon
            const isMap = action.id === 'map'
            return (
              <motion.button
                key={action.id}
                type="button"
                onClick={() => onNavigate(action.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.16 + i * 0.06, ease: [0.32, 0.72, 0, 1] }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex flex-col gap-2.5 rounded-2xl border border-[#1C2B40] bg-[#12233A] p-3.5 text-left transition-colors',
                  'hover:border-[#223652] hover:bg-[#152a44]',
                  isMap && 'sm:col-span-1',
                )}
              >
                {isMap ? (
                  <MapThumbnail className="h-14 w-full" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C2B40] text-[#8CA0B8]">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                )}
                <span className="space-y-0.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-[#F2F6FA]">
                    {isMap && <Map className="h-3.5 w-3.5 shrink-0 text-[#7690AC]" strokeWidth={1.75} />}
                    {action.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-[#7690AC]">{action.hint}</span>
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="mx-auto mt-auto w-full max-w-lg pb-6 pt-10 lg:pb-10"
      >
        <GlassCard className="!rounded-2xl !border-[#1C2B40] !bg-[#12233A]/80 !p-4 !shadow-none">
          <p className="text-center text-xs leading-relaxed text-[#7690AC]">
            Si hay riesgo de vida, llama primero al{' '}
            <span className="font-semibold text-[#F2F6FA]">911</span> o a Protección Civil antes de
            usar FARO.
          </p>
        </GlassCard>

        {onJoinNetwork && (
          <button
            type="button"
            onClick={onJoinNetwork}
            className="mx-auto mt-4 flex items-center gap-2 text-xs text-[#2DD4BF] transition-colors hover:text-[#2DD4BF]/80"
          >
            ¿Eres voluntario, gestor o coordinador? Únete a la Red FARO
          </button>
        )}
      </motion.div>
    </div>
  )
}
