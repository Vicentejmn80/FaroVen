import { motion } from 'framer-motion'
import {
  Activity,
  Building2,
  ChevronDown,
  PackagePlus,
  PenLine,
  PlusCircle,
  Settings2,
  Shield,
  Truck,
  TruckIcon,
} from 'lucide-react'
import { QuickAction } from '@/components/faro/quick-action'
import { SectionTitle } from '@/components/faro/section-title'
import { TimelineItem } from '@/components/faro/timeline-item'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { TabId } from '@/components/faro/app-navigation'
import type { OperationalStatus } from '@/lib/types'
import { useFaro } from '@/store/faro-context'

export type ActionId =
  | 'register-site'
  | 'register-need'
  | 'update-saturation'
  | 'register-arrival'
  | 'register-dispatch'
  | 'report'

interface ActionDef {
  id: ActionId | 'navigate'
  icon: typeof Activity
  label: string
  hint: string
  accent: OperationalStatus
  tab?: TabId
}

const COORDINATOR_ACTIONS: ActionDef[] = [
  { id: 'navigate', icon: Building2, label: 'Mi Centro', hint: 'Panel operativo del sitio', accent: 'operational', tab: 'ops' },
  { id: 'register-need', icon: PackagePlus, label: 'Registrar necesidad', hint: 'Insumos que faltan', accent: 'warning' },
  { id: 'update-saturation', icon: Activity, label: 'Actualizar saturación', hint: 'Necesidades prioritarias', accent: 'critical' },
  { id: 'register-arrival', icon: Truck, label: 'Registrar llegada', hint: 'Donaciones recibidas', accent: 'operational' },
  { id: 'register-dispatch', icon: TruckIcon, label: 'Registrar salida', hint: 'Recursos distribuidos', accent: 'info' },
]

const CITIZEN_ACTIONS: ActionDef[] = [
  { id: 'report', icon: PenLine, label: 'Reportar información', hint: 'Reporte ciudadano', accent: 'info' },
]

const ADMIN_ACTIONS: ActionDef[] = [
  { id: 'register-site', icon: PlusCircle, label: 'Registrar centro', hint: 'Hospital, refugio o acopio', accent: 'operational' },
  { id: 'update-saturation', icon: Activity, label: 'Actualizar saturación', hint: 'Necesidades prioritarias', accent: 'critical' },
  { id: 'navigate', icon: Shield, label: 'Administración', hint: 'Solicitudes y usuarios', accent: 'info', tab: 'admin' },
  { id: 'navigate', icon: Settings2, label: 'Sistema', hint: 'Configuración global', accent: 'info', tab: 'system' },
]

interface ActionsScreenProps {
  onClose: () => void
  onAction: (action: ActionId) => void
  onNavigate?: (tab: TabId) => void
  mode: 'citizen' | 'coordinator' | 'admin'
  showSystem?: boolean
}

export function ActionsScreen({ onClose, onAction, onNavigate, mode, showSystem = true }: ActionsScreenProps) {
  const { latestActivity } = useFaro()
  const actions =
    mode === 'coordinator'
      ? COORDINATOR_ACTIONS
      : mode === 'admin'
        ? ADMIN_ACTIONS.filter((a) => showSystem || a.tab !== 'system')
        : CITIZEN_ACTIONS

  const handleClick = (action: ActionDef) => {
    if (action.id === 'navigate' && action.tab) {
      onNavigate?.(action.tab)
      onClose()
      return
    }
    onAction(action.id as ActionId)
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      className="absolute inset-0 z-50 flex flex-col bg-base-900/80 backdrop-blur-2xl lg:rounded-2xl"
    >
      <div className="flex flex-col items-center px-5 pt-safe">
        <EmergencyButton variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" className="mt-2">
          <ChevronDown className="h-6 w-6" />
        </EmergencyButton>
        <div className="w-full px-1 pb-2">
          <p className="text-sm text-ink-muted">Operaciones en vivo</p>
          <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight text-ink">
            {mode === 'coordinator'
              ? '¿Qué vas a actualizar?'
              : mode === 'admin'
                ? 'Acciones de administración'
                : '¿Qué quieres reportar?'}
          </h1>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-32">
        <div className={mode === 'coordinator' ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-1 gap-2.5'}>
          {actions.map((a, i) => (
            <QuickAction
              key={`${a.id}-${a.tab ?? i}`}
              icon={a.icon}
              label={a.label}
              hint={a.hint}
              accent={a.accent}
              index={i}
              onClick={() => handleClick(a)}
            />
          ))}
        </div>

        <section className="mt-7 space-y-3">
          <SectionTitle>Actividad reciente</SectionTitle>
          <div>
            {latestActivity.length ? (
              latestActivity.map((e, i) => (
                <TimelineItem key={e.id} event={e} index={i} last={i === latestActivity.length - 1} />
              ))
            ) : (
              <p className="text-sm text-ink-subtle">Sin actividad aún. Registra el primer sitio para empezar.</p>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  )
}
