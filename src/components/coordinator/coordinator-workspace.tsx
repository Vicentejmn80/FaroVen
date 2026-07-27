import { useMemo, useState } from 'react'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import {
  PackagePlus,
  ClipboardList,
  History,
  Boxes,
  Zap,
  Activity,
  UserCheck,
  Shield,
  MoreHorizontal,
  Package,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { CoordinatorReportsInbox } from '@/components/coordinator/coordinator-reports-inbox'
import { CoordinatorHistoryModule } from '@/components/coordinator/coordinator-history-module'
import { CoordinatorSaturationModule } from '@/components/coordinator/coordinator-saturation-module'
import { CenterSummaryCard } from './center-summary-card'
import { SectionHeader } from './section-header'
import { ActionToolbar } from './action-toolbar'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import {
  useCoordinatorDashboard,
  useCoordinatorSite,
  useCoordinatorNeeds,
  useCoordinatorReports,
} from '@/hooks/useCoordinatorPanel'
import { useMissionsByCenter } from '@/hooks/useMissions'
import { CoordinatorCasePanel } from './coordinator-case-panel'
import { CoordinatorInventoryPanel } from './coordinator-resources-panel'
import { CoordinatorCapacityEditor } from './coordinator-capacity-editor'
import { CoordinatorMissionPanel } from './coordinator-mission-panel'
import { CoordinatorNeedsSmartPanel } from './coordinator-needs-smart-panel'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
import type { Site } from '@/lib/types'
import { MISSION_STAGES, type MissionStage } from '@/domain/mission.types'

const PRIMARY_MODULES: Array<{ id: CoordinatorModuleId; label: string; icon: typeof PackagePlus }> = [
  { id: 'dashboard', label: 'Estado', icon: Zap },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'needs', label: 'Necesidades', icon: PackagePlus },
  { id: 'missions', label: 'Misiones', icon: Shield },
  { id: 'history', label: 'Historial', icon: History },
]

const MORE_MODULES: Array<{ id: CoordinatorModuleId; label: string; icon: typeof PackagePlus }> = [
  { id: 'reports', label: 'Reportes', icon: ClipboardList },
  { id: 'cases', label: 'Casos', icon: UserCheck },
  { id: 'saturation', label: 'Saturación', icon: Activity },
  { id: 'donations', label: 'Donaciones', icon: Boxes },
  { id: 'center-ops', label: 'Capacidad', icon: Activity },
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

export function CoordinatorWorkspace({
  activeModule,
  onModuleChange,
  onRegisterNeed,
  onUpdateSaturation,
  onRegisterArrival,
  onRegisterDispatch,
}: CoordinatorWorkspaceProps) {
  const { assignment } = useCoordinatorAssignment()
  const site = useCoordinatorSite()
  const dashboard = useCoordinatorDashboard()
  const coordinatorNeeds = useCoordinatorNeeds()
  const pendingReports = useCoordinatorReports('pending')
  const { data: missions = [] } = useMissionsByCenter(assignment?.siteId ?? '')
  const [internalModule, setInternalModule] = useState<CoordinatorModuleId>('dashboard')
  const [showMore, setShowMore] = useState(false)
  const module = activeModule ?? internalModule
  const pendingClosures = coordinatorNeeds.filter((n) => n.status === 'pending_closure').length

  const activeMissionCount = useMemo(() => {
    const active: MissionStage[] = [
      MISSION_STAGES.CREATED,
      MISSION_STAGES.MATCHING,
      MISSION_STAGES.ASSIGNED,
      MISSION_STAGES.ACCEPTED,
      MISSION_STAGES.EN_ROUTE,
      MISSION_STAGES.ON_SITE,
      MISSION_STAGES.IN_PROGRESS,
      MISSION_STAGES.COMPLETED,
    ]
    return missions.filter((m) => active.includes(m.status)).length
  }, [missions])

  useRealtimeSync({
    channelName: 'coordinator-live',
    tables: [
      'public_needs',
      'coverage_reservations',
      'missions',
      'mission_assignments',
      'mission_applications',
      'reports',
      'needs',
      'cases',
      'center_resources',
      'center_inventory_movements',
      'center_events',
    ],
    invalidateKeys: [
      FARO_QUERY_KEYS.publicNeeds,
      FARO_QUERY_KEYS.coverage,
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.missionApplications,
      FARO_QUERY_KEYS.reports,
      FARO_QUERY_KEYS.needs,
      FARO_QUERY_KEYS.cases,
      FARO_QUERY_KEYS.centerResources,
      FARO_QUERY_KEYS.centerEvents,
      FARO_QUERY_KEYS.centerProfile,
    ],
  })

  const setModule = (next: CoordinatorModuleId) => {
    if (onModuleChange) onModuleChange(next)
    else setInternalModule(next)
    setShowMore(false)
  }

  const openSuggestedNeed = (preset?: {
    categoryKey?: string
    itemName?: string
    quantity?: number
  }) => {
    if (preset?.itemName) {
      try {
        sessionStorage.setItem(
          'faro:need-preset',
          JSON.stringify({
            categoryKey: preset.categoryKey,
            itemName: preset.itemName,
            quantity: preset.quantity,
          }),
        )
      } catch {
        /* ignore */
      }
    }
    onRegisterNeed?.(site?.id)
  }

  if (!assignment || !site || !dashboard) return null

  const isMoreActive = MORE_MODULES.some((m) => m.id === module)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-safe pb-3 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="truncate text-lg font-semibold text-ink">{dashboard.siteName}</h1>
          <p className="text-xs text-ink-subtle">{dashboard.siteTypeLabel} · Nodo logístico</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-operational/15 px-2.5 py-1 text-xs font-medium text-operational">
            <span className="h-1.5 w-1.5 rounded-full bg-operational" />
            En línea
          </span>
        </div>
      </header>

      <div className="faro-scroll no-scrollbar px-4 pb-6 lg:px-8 lg:pb-8">
        <div className="space-y-4 pt-2">
          <ContextualHelpCard moduleId="ops" />

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {PRIMARY_MODULES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModule(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    module === item.id
                      ? 'border-info/50 bg-info/15 text-ink'
                      : 'border-white/10 bg-white/[0.04] text-ink-subtle hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {item.id === 'needs' && pendingClosures > 0 && (
                    <span className="ml-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                      {pendingClosures}
                    </span>
                  )}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isMoreActive || showMore
                  ? 'border-info/50 bg-info/15 text-ink'
                  : 'border-white/10 bg-white/[0.04] text-ink-subtle hover:bg-white/[0.08]'
              }`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              Más
            </button>
          </div>

          {showMore && (
            <div className="flex flex-wrap gap-2">
              {MORE_MODULES.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModule(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      module === item.id
                        ? 'border-info/50 bg-info/15 text-ink'
                        : 'border-white/10 bg-white/[0.04] text-ink-subtle'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          )}

          {module === 'dashboard' && (
            <div className="space-y-4">
              <CenterSummaryCard
                site={site}
                metrics={dashboard}
                activeMissionsCount={activeMissionCount}
              />
              <GlassCard className="space-y-3">
                <SectionHeader title="Acciones rápidas" icon={Zap} />
                <ActionToolbar
                  actions={[
                    {
                      icon: Package,
                      label: 'Inventario',
                      onClick: () => setModule('inventory'),
                      variant: 'primary',
                    },
                    {
                      icon: PackagePlus,
                      label: 'Necesidad',
                      onClick: () => openSuggestedNeed(),
                    },
                    {
                      icon: Shield,
                      label: 'Misiones',
                      onClick: () => setModule('missions'),
                    },
                    {
                      icon: ClipboardList,
                      label: 'Reportes',
                      onClick: () => setModule('reports'),
                    },
                  ]}
                />
              </GlassCard>
              {pendingReports.length > 0 && (
                <GlassCard className="space-y-2 p-3.5">
                  <p className="text-xs text-warning">
                    {pendingReports.length} reporte(s) ciudadano(s) pendiente(s)
                  </p>
                  <EmergencyButton variant="glass" size="sm" onClick={() => setModule('reports')}>
                    Revisar bandeja
                  </EmergencyButton>
                </GlassCard>
              )}
            </div>
          )}

          {module === 'inventory' && <CoordinatorInventoryPanel />}

          {module === 'needs' && (
            <CoordinatorNeedsSmartPanel onCreateNeed={openSuggestedNeed} />
          )}

          {module === 'missions' && <CoordinatorMissionPanel />}

          {module === 'history' && <CoordinatorHistoryModule />}

          {module === 'donations' && (
            <GlassCard className="space-y-3">
              <SectionHeader
                title="Donaciones"
                subtitle="Entradas y salidas también se registran en Inventario"
                icon={Boxes}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <DonationAction
                  icon={Boxes}
                  label="Registrar llegada"
                  hint="Donaciones recibidas"
                  onClick={() => onRegisterArrival?.(site.id)}
                />
                <DonationAction
                  icon={Boxes}
                  label="Registrar salida"
                  hint="Recursos distribuidos"
                  onClick={() => onRegisterDispatch?.(site.id)}
                />
              </div>
              <EmergencyButton variant="primary" size="sm" onClick={() => setModule('inventory')}>
                Ir a inventario
              </EmergencyButton>
            </GlassCard>
          )}

          {module === 'saturation' && (
            <CoordinatorSaturationModule
              site={site}
              metrics={dashboard}
              onUpdatePeople={() => onUpdateSaturation?.(site.id)}
            />
          )}

          {module === 'reports' && <CoordinatorReportsInbox />}

          {module === 'cases' && <CoordinatorCasePanel />}

          {module === 'center-ops' && <CoordinatorCapacityEditor />}
        </div>
      </div>
    </div>
  )
}

function DonationAction({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Boxes
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
