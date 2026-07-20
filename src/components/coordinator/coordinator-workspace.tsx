import { useState } from 'react'
import {
  PackagePlus,
  ClipboardList,
  History,
  Boxes,
  Zap,
  Activity,
  Bell,
  UserCheck,
  Settings2,
  Shield,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { CoordinatorNeedsModule } from '@/components/coordinator/coordinator-needs-module'
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
import { CoordinatorCasePanel } from './coordinator-case-panel'
import { CoordinatorResourcesPanel } from './coordinator-resources-panel'
import { CoordinatorSupportPanel } from './coordinator-support-panel'
import { CoordinatorCapacityEditor } from './coordinator-capacity-editor'
import { CoordinatorMissionPanel } from './coordinator-mission-panel'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
import type { Site } from '@/lib/types'

const MODULES: Array<{ id: CoordinatorModuleId; label: string; icon: typeof PackagePlus }> = [
  { id: 'dashboard', label: 'Resumen', icon: Zap },
  { id: 'needs', label: 'Necesidades', icon: PackagePlus },
  { id: 'donations', label: 'Donaciones', icon: Boxes },
  { id: 'saturation', label: 'Saturación', icon: Activity },
  { id: 'reports', label: 'Reportes', icon: ClipboardList },
  { id: 'cases', label: 'Casos', icon: UserCheck },
  { id: 'center-ops', label: 'Centro', icon: Settings2 },
  { id: 'missions', label: 'Misiones', icon: Shield },
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
  const [internalModule, setInternalModule] = useState<CoordinatorModuleId>('dashboard')
  const module = activeModule ?? internalModule
  const pendingClosures = coordinatorNeeds.filter((n) => n.status === 'pending_closure').length

  const setModule = (next: CoordinatorModuleId) => {
    if (onModuleChange) onModuleChange(next)
    else setInternalModule(next)
  }

  if (!assignment || !site || !dashboard) return null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-safe pb-3 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="truncate text-lg font-semibold text-ink">{dashboard.siteName}</h1>
          <p className="text-xs text-ink-subtle">{dashboard.siteTypeLabel} · Panel operativo</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-operational/15 px-2.5 py-1 text-xs font-medium text-operational">
            <span className="h-1.5 w-1.5 rounded-full bg-operational" />
            En línea
          </span>
          <EmergencyButton variant="glass" size="icon" aria-label="Notificaciones">
            <Bell className="h-4 w-4" />
          </EmergencyButton>
        </div>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-32 lg:px-8 lg:pb-8">
        <div className="space-y-4 pt-2">
          <ContextualHelpCard moduleId="ops" />

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {MODULES.map((item) => {
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
          </div>

          {module === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="space-y-4">
                  <CenterSummaryCard site={site} metrics={dashboard} />
                  <GlassCard className="space-y-3">
                    <SectionHeader title="Acciones rápidas" icon={Zap} />
                    <ActionToolbar
                      actions={[
                        { icon: PackagePlus, label: 'Nueva necesidad', onClick: () => onRegisterNeed?.(site.id), variant: 'primary' },
                        { icon: Boxes, label: 'Inventario', onClick: () => onRegisterArrival?.(site.id) },
                        { icon: ClipboardList, label: 'Reportes', onClick: () => setModule('reports') },
                        { icon: History, label: 'Historial', onClick: () => setModule('history') },
                      ]}
                    />
                  </GlassCard>
                </div>

                <div className="space-y-4">
                  <GlassCard className="space-y-3">
                    <SectionHeader
                      title="Necesidades activas"
                      subtitle={`${coordinatorNeeds.filter((n) => n.status !== 'resolved').length} operativas`}
                      icon={PackagePlus}
                      action={
                        <EmergencyButton variant="primary" size="sm" onClick={() => onRegisterNeed?.(site.id)}>
                          + Agregar
                        </EmergencyButton>
                      }
                    />
                    <CoordinatorNeedsModule onCreateNeed={() => onRegisterNeed?.(site.id)} />
                  </GlassCard>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <GlassCard className="space-y-3">
                  <SectionHeader
                    title="Reportes ciudadanos"
                    subtitle={`${pendingReports.length} pendientes`}
                    icon={ClipboardList}
                    action={
                      <EmergencyButton variant="glass" size="sm" onClick={() => setModule('reports')}>
                        Ver todos
                      </EmergencyButton>
                    }
                  />
                  <CoordinatorReportsInbox />
                </GlassCard>

                <GlassCard className="space-y-3">
                  <SectionHeader
                    title="Actividad reciente"
                    icon={Activity}
                    action={
                      <EmergencyButton variant="glass" size="sm" onClick={() => setModule('history')}>
                        Ver todo
                      </EmergencyButton>
                    }
                  />
                  <CoordinatorHistoryModule />
                </GlassCard>
              </div>
            </div>
          )}

          {module === 'needs' && (
            <CoordinatorNeedsModule onCreateNeed={() => onRegisterNeed?.(site.id)} />
          )}

          {module === 'donations' && (
            <GlassCard className="space-y-3">
              <SectionHeader title="Registro de donaciones" subtitle="Cada movimiento actualiza inventario, necesidades e historial en tiempo real" icon={Boxes} />
              <div className="grid grid-cols-2 gap-2.5">
                <DonationAction icon={Boxes} label="Registrar llegada" hint="Donaciones recibidas" onClick={() => onRegisterArrival?.(site.id)} />
                <DonationAction icon={Boxes} label="Registrar salida" hint="Recursos distribuidos" onClick={() => onRegisterDispatch?.(site.id)} />
              </div>
            </GlassCard>
          )}

          {module === 'saturation' && (
            <CoordinatorSaturationModule site={site} metrics={dashboard} onUpdatePeople={() => onUpdateSaturation?.(site.id)} />
          )}

          {module === 'reports' && (
            <CoordinatorReportsInbox focusReportId={undefined} onFocusReportClear={undefined} />
          )}

          {module === 'cases' && <CoordinatorCasePanel />}

          {module === 'center-ops' && (
            <div className="space-y-4">
              <CoordinatorCapacityEditor />
              <CoordinatorResourcesPanel />
              <CoordinatorSupportPanel />
            </div>
          )}

          {module === 'missions' && <CoordinatorMissionPanel />}

          {module === 'history' && <CoordinatorHistoryModule />}
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
