import { useEffect, useState } from 'react'
import {
  BarChart3,
  ClipboardList,
  History,
  Package,
  PackagePlus,
  Truck,
  TruckIcon,
} from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyBadge } from '@/components/faro/emergency-badge'
import { CoordinatorDashboard } from '@/components/coordinator/coordinator-dashboard'
import { CoordinatorNeedsModule } from '@/components/coordinator/coordinator-needs-module'
import { CoordinatorReportsInbox } from '@/components/coordinator/coordinator-reports-inbox'
import { CoordinatorHistoryModule } from '@/components/coordinator/coordinator-history-module'
import { CoordinatorSaturationModule } from '@/components/coordinator/coordinator-saturation-module'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import {
  useCoordinatorDashboard,
  useCoordinatorSite,
} from '@/hooks/useCoordinatorPanel'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
import { cn, timeAgo } from '@/lib/utils'
import type { Site } from '@/lib/types'

const MODULES: Array<{ id: CoordinatorModuleId; label: string; icon: typeof Package }> = [
  { id: 'dashboard', label: 'Resumen', icon: BarChart3 },
  { id: 'needs', label: 'Necesidades', icon: PackagePlus },
  { id: 'donations', label: 'Donaciones', icon: Truck },
  { id: 'saturation', label: 'Saturación', icon: BarChart3 },
  { id: 'reports', label: 'Reportes', icon: ClipboardList },
  { id: 'history', label: 'Historial', icon: History },
]

interface CoordinatorPanelScreenProps {
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

export function CoordinatorPanelScreen({
  activeModule,
  onModuleChange,
  focusReportId,
  onFocusReportClear,
  onOpenDetail,
  onRegisterNeed,
  onUpdateSaturation,
  onRegisterArrival,
  onRegisterDispatch,
}: CoordinatorPanelScreenProps) {
  const { assignment } = useCoordinatorAssignment()
  const site = useCoordinatorSite()
  const dashboard = useCoordinatorDashboard()
  const [internalModule, setInternalModule] = useState<CoordinatorModuleId>('dashboard')
  const module = activeModule ?? internalModule

  const setModule = (next: CoordinatorModuleId) => {
    if (onModuleChange) onModuleChange(next)
    else setInternalModule(next)
  }

  useEffect(() => {
    if (activeModule) setInternalModule(activeModule)
  }, [activeModule])

  if (!assignment || !site || !dashboard) return null

  return (
    <ScreenScaffold
      title={dashboard.siteName}
      subtitle={`${dashboard.siteTypeLabel} · Panel operativo`}
    >
      <div className="space-y-4 pt-2">
        <GlassCard className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">Centro asignado</p>
            <p className="truncate text-[17px] font-semibold text-ink">{dashboard.siteName}</p>
            <p className="mt-1 text-xs text-ink-subtle">
              Actualizado {timeAgo(dashboard.lastUpdated)}
            </p>
          </div>
          <EmergencyBadge status={site.status} />
        </GlassCard>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {MODULES.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setModule(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  module === item.id
                    ? 'border-info/50 bg-info/15 text-ink'
                    : 'border-white/10 bg-white/[0.04] text-ink-subtle hover:bg-white/[0.08]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>

        {module === 'dashboard' && (
          <CoordinatorDashboard
            metrics={dashboard}
            onOpenDetail={() => onOpenDetail?.(site)}
            onGoNeeds={() => setModule('needs')}
            onGoReports={() => setModule('reports')}
          />
        )}

        {module === 'needs' && (
          <CoordinatorNeedsModule onCreateNeed={() => onRegisterNeed?.(site.id)} />
        )}

        {module === 'donations' && (
          <GlassCard className="space-y-3">
            <p className="text-sm font-medium text-ink">Registro de donaciones</p>
            <p className="text-xs text-ink-subtle">
              Cada movimiento actualiza inventario, necesidades e historial en tiempo real.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <DonationAction
                icon={Truck}
                label="Registrar llegada"
                hint="Donaciones recibidas"
                onClick={() => onRegisterArrival?.(site.id)}
              />
              <DonationAction
                icon={TruckIcon}
                label="Registrar salida"
                hint="Recursos distribuidos"
                onClick={() => onRegisterDispatch?.(site.id)}
              />
            </div>
          </GlassCard>
        )}

        {module === 'saturation' && (
          <CoordinatorSaturationModule
            site={site}
            metrics={dashboard}
            onUpdatePeople={() => onUpdateSaturation?.(site.id)}
          />
        )}

        {module === 'reports' && (
          <CoordinatorReportsInbox
            focusReportId={focusReportId}
            onFocusReportClear={onFocusReportClear}
          />
        )}

        {module === 'history' && <CoordinatorHistoryModule />}
      </div>
    </ScreenScaffold>
  )
}

function DonationAction({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Truck
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass rounded-3xl p-3 text-left transition-colors hover:bg-white/[0.09]"
    >
      <Icon className="h-4.5 w-4.5 text-info" />
      <p className="mt-2 text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-ink-subtle">{hint}</p>
    </button>
  )
}
