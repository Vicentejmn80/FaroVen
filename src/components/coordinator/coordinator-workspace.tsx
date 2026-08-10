import { useMemo, useState } from 'react'
import { Package, ClipboardList, Truck, History } from 'lucide-react'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { CoordinatorHistoryModule } from '@/components/coordinator/coordinator-history-module'
import { CoordinatorInventoryPanel } from '@/components/coordinator/coordinator-resources-panel'
import { CoordinatorLogisticsRequests } from '@/components/coordinator/coordinator-logistics-requests'
import { CoordinatorLogisticsMissions } from '@/components/coordinator/coordinator-logistics-missions'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useCoordinatorSite } from '@/hooks/useCoordinatorPanel'
import { useCenterReservations } from '@/hooks/useLogistics'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
import type { Site } from '@/lib/types'

const LOGISTICS_MODULES: Array<{
  id: Extract<CoordinatorModuleId, 'inventory' | 'needs' | 'missions' | 'history'>
  label: string
  icon: typeof Package
}> = [
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'needs', label: 'Solicitudes', icon: ClipboardList },
  { id: 'missions', label: 'Misiones', icon: Truck },
  { id: 'history', label: 'Historial', icon: History },
]

interface CoordinatorWorkspaceProps {
  activeModule?: CoordinatorModuleId
  onModuleChange?: (module: CoordinatorModuleId) => void
  focusReportId?: string | null
  onFocusReportClear?: () => void
  onOpenDetail?: (site: Site) => void
  onRegisterNeed?: (siteId?: string) => void
  onUpdateSaturation?: (siteId?: string) => void
  onRegisterArrival?: (siteId?: string) => void
  onRegisterDispatch?: (siteId?: string) => void
}

function normalizeModule(module: CoordinatorModuleId | undefined): (typeof LOGISTICS_MODULES)[number]['id'] {
  if (module === 'inventory' || module === 'needs' || module === 'missions' || module === 'history') {
    return module
  }
  // Compat: deep-links viejos (dashboard/preparations/reports…) → estación logística
  if (module === 'preparations') return 'needs'
  return 'inventory'
}

/**
 * Estación logística del Coordinador.
 * Solo administra inventario y prepara recursos solicitados por el GC.
 * No administra casos, voluntarios ni reportes.
 */
export function CoordinatorWorkspace({
  activeModule,
  onModuleChange,
}: CoordinatorWorkspaceProps) {
  const { assignment } = useCoordinatorAssignment()
  const site = useCoordinatorSite()
  const { data: reservations = [] } = useCenterReservations(assignment?.siteId)
  const [internalModule, setInternalModule] = useState<(typeof LOGISTICS_MODULES)[number]['id']>('inventory')
  const module = normalizeModule(activeModule ?? internalModule)

  const pendingRequestsCount = useMemo(
    () => reservations.filter((r) => r.status === 'reserved' && !r.resolutionMode).length,
    [reservations],
  )
  /** Misiones aceptadas (brigada/delivery) esperando avance del coordinador. */
  const activeMissionsCount = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.status === 'ready' &&
          (r.resolutionMode === 'brigade' || r.resolutionMode === 'delivery'),
      ).length,
    [reservations],
  )
  const moduleBadges = useMemo(
    () =>
      ({
        needs: pendingRequestsCount,
        missions: activeMissionsCount,
      }) as Partial<Record<(typeof LOGISTICS_MODULES)[number]['id'], number>>,
    [pendingRequestsCount, activeMissionsCount],
  )

  useRealtimeSync({
    channelName: 'coordinator-logistics',
    tables: [
      'inventory_reservations',
      'center_resources',
      'center_inventory_movements',
      'missions',
      'mission_assignments',
      'cases',
    ],
    invalidateKeys: [
      FARO_QUERY_KEYS.inventoryReservations,
      FARO_QUERY_KEYS.centerResources,
      FARO_QUERY_KEYS.centerEvents,
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.cases,
    ],
  })

  const setModule = (next: (typeof LOGISTICS_MODULES)[number]['id']) => {
    if (onModuleChange) onModuleChange(next)
    else setInternalModule(next)
  }

  const subtitle = useMemo(() => {
    if (!assignment) return 'Sin centro asignado'
    return `${assignment.siteName} · Estación logística`
  }, [assignment])

  if (!assignment || !site) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-safe pb-3 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO · Coordinador</p>
          <h1 className="truncate text-lg font-semibold text-ink">{assignment.siteName}</h1>
          <p className="text-xs text-ink-subtle">{subtitle}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-operational/15 px-2.5 py-1 text-xs font-medium text-operational">
          <span className="h-1.5 w-1.5 rounded-full bg-operational" />
          En línea
        </span>
      </header>

      <div className="faro-scroll no-scrollbar px-4 pb-6 lg:px-8 lg:pb-8">
        <div className="space-y-4 pt-2">
          <ContextualHelpCard moduleId="ops" />

          <div className="grid grid-cols-4 gap-1.5">
            {LOGISTICS_MODULES.map((item) => {
              const Icon = item.icon
              const active = module === item.id
              const badge = moduleBadges[item.id] ?? 0
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModule(item.id)}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-info/40 bg-info/12 text-info'
                      : 'border-white/10 bg-white/[0.03] text-ink-subtle hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.25 : 1.75} />
                  {item.label}
                  {badge > 0 && (
                    <span
                      className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white ${
                        item.id === 'missions' ? 'bg-warning text-[#1a1200]' : 'bg-critical'
                      }`}
                    >
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {module === 'inventory' && <CoordinatorInventoryPanel />}
          {module === 'needs' && (
            <CoordinatorLogisticsRequests onPrepared={() => setModule('missions')} />
          )}
          {module === 'missions' && <CoordinatorLogisticsMissions />}
          {module === 'history' && <CoordinatorHistoryModule />}
        </div>
      </div>
    </div>
  )
}
