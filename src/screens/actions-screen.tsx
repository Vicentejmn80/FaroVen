import { motion } from 'framer-motion'
import {
  Activity,
  Building2,
  ChevronDown,
  ClipboardPlus,
  PackagePlus,
  PenLine,
  PlusCircle,
  Settings2,
  Shield,
  Truck,
  TruckIcon,
  UserPlus,
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
  | 'create-case'
  | 'assign-resource'

export type ActionsMode = 'citizen' | 'volunteer' | 'coordinator' | 'admin' | 'case_manager'

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
  { id: 'report', icon: PenLine, label: 'Reportar emergencia', hint: 'Alerta ciudadana inmediata', accent: 'critical' },
  { id: 'register-need', icon: PackagePlus, label: 'Registrar nueva necesidad', hint: 'Insumo o apoyo requerido', accent: 'warning' },
]

const VOLUNTEER_ACTIONS: ActionDef[] = [
  { id: 'report', icon: PenLine, label: 'Reportar emergencia', hint: 'Alerta en tu zona', accent: 'critical' },
  { id: 'navigate', icon: PackagePlus, label: 'Registrar nueva necesidad', hint: 'Ver y apoyar necesidades activas', accent: 'warning', tab: 'needs' },
]

const CASE_MANAGER_ACTIONS: ActionDef[] = [
  { id: 'create-case', icon: ClipboardPlus, label: 'Crear caso manualmente', hint: 'Ingreso directo al pipeline', accent: 'info' },
  { id: 'assign-resource', icon: UserPlus, label: 'Asignar recurso', hint: 'Abrir comando y asignar centro', accent: 'operational' },
  { id: 'navigate', icon: Building2, label: 'Centro de comando', hint: 'Pipeline operativo', accent: 'info', tab: 'map' },
  { id: 'navigate', icon: ClipboardPlus, label: 'Bandeja gestor', hint: 'Reportes y conversiones', accent: 'warning', tab: 'case-manager' },
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
  mode: ActionsMode
  showSystem?: boolean
}

const MODE_TITLE: Record<ActionsMode, string> = {
  coordinator: '¿Qué vas a actualizar?',
  admin: 'Acciones de administración',
  case_manager: 'Acción operativa',
  volunteer: 'Acción rápida',
  citizen: '¿Qué necesitas hacer?',
}

const MODE_SUBTITLE: Record<ActionsMode, string> = {
  coordinator: 'Operaciones en vivo',
  admin: 'Control de red',
  case_manager: 'Centro de comando',
  volunteer: 'Apoyo en campo',
  citizen: 'Acceso rápido',
}

function actionsForMode(mode: ActionsMode, showSystem: boolean): ActionDef[] {
  if (mode === 'coordinator') return COORDINATOR_ACTIONS
  if (mode === 'admin') return ADMIN_ACTIONS.filter((a) => showSystem || a.tab !== 'system')
  if (mode === 'case_manager') return CASE_MANAGER_ACTIONS
  if (mode === 'volunteer') return VOLUNTEER_ACTIONS
  return CITIZEN_ACTIONS
}

export function ActionsScreen({
  onClose,
  onAction,
  onNavigate,
  mode,
  showSystem = true,
}: ActionsScreenProps) {
  const { latestActivity } = useFaro()
  const actions = actionsForMode(mode, showSystem)
  const gridCols =
    mode === 'coordinator' || mode === 'case_manager' || mode === 'admin'
      ? 'grid-cols-2'
      : 'grid-cols-1'

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
          <p className="text-sm text-ink-muted">{MODE_SUBTITLE[mode]}</p>
          <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight text-ink">
            {MODE_TITLE[mode]}
          </h1>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-32">
        <div className={`grid gap-2.5 ${gridCols}`}>
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

        {(mode === 'coordinator' || mode === 'admin') && (
          <section className="mt-7 space-y-3">
            <SectionTitle>Actividad reciente</SectionTitle>
            <div>
              {latestActivity.length ? (
                latestActivity.map((e, i) => (
                  <TimelineItem key={e.id} event={e} index={i} last={i === latestActivity.length - 1} />
                ))
              ) : (
                <p className="text-sm text-ink-subtle">
                  Sin actividad aún. Registra el primer sitio para empezar.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </motion.div>
  )
}
