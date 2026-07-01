import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EmergencyHeader } from '@/components/faro/emergency-header'
import { ConnectionBanner } from '@/components/faro/connection-banner'
import { CoordinatorNotificationsSheet } from '@/components/coordinator/coordinator-notifications-sheet'
import { useCoordinatorNotifications } from '@/hooks/useCoordinatorNotifications'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
import type { Report } from '@/domain/models'
import {
  BottomNavigation,
  CITIZEN_TABS,
  COORDINATOR_TABS,
  DesktopNavigation,
  type TabId,
} from '@/components/faro/app-navigation'
import { ActionsScreen, type ActionId } from '@/screens/actions-screen'
import { RegisterSiteFlow } from '@/screens/register-site-flow'
import { RegisterNeedFlow } from '@/screens/register-need-flow'
import { UpdateSaturationFlow } from '@/screens/update-saturation-flow'
import { CoordinatorSetupScreen } from '@/screens/coordinator-setup-screen'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useToast } from '@/store/toast-context'
import { useFaro } from '@/store/faro-context'
import { AdjustNeedStockFlow } from '@/screens/adjust-need-stock-flow'
import type { Site } from '@/lib/types'
import { useAppMode } from '@/store/app-mode-context'
import { Skeleton } from '@/components/ui/skeleton'

type FlowId = ActionId | 'menu'

const SituationScreen = lazy(() =>
  import('@/screens/situation-screen').then((m) => ({ default: m.SituationScreen })),
)
const ActivityScreen = lazy(() =>
  import('@/screens/activity-screen').then((m) => ({ default: m.ActivityScreen })),
)
const ReportsScreen = lazy(() =>
  import('@/screens/reports-screen').then((m) => ({ default: m.ReportsScreen })),
)
const ProfileScreen = lazy(() =>
  import('@/screens/profile-screen').then((m) => ({ default: m.ProfileScreen })),
)
const CenterDetailScreen = lazy(() =>
  import('@/screens/center-detail-screen').then((m) => ({ default: m.CenterDetailScreen })),
)
const CoordinatorPanelScreen = lazy(() =>
  import('@/screens/coordinator-panel-screen').then((m) => ({ default: m.CoordinatorPanelScreen })),
)

function ScreenLoading() {
  return (
    <div className="space-y-3 px-4 pt-4">
      <Skeleton className="h-24 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-20 w-full rounded-3xl" />
    </div>
  )
}

export default function App() {
  const { mode } = useAppMode()
  const { cachedAt } = useFaro()
  const [tab, setTab] = useState<TabId>('map')
  const [flow, setFlow] = useState<FlowId | null>(null)
  const [needPresetSiteId, setNeedPresetSiteId] = useState<string | undefined>()
  const [detailSite, setDetailSite] = useState<Site | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [coordinatorModule, setCoordinatorModule] = useState<CoordinatorModuleId>('dashboard')
  const [focusReportId, setFocusReportId] = useState<string | null>(null)
  const coordinatorNotif = useCoordinatorNotifications()
  const network = useNetworkStatus()
  const previousNetworkState = useRef(network.state)
  const { showToast } = useToast()
  const tabs = mode === 'coordinator' ? COORDINATOR_TABS : CITIZEN_TABS

  useEffect(() => {
    setTab(mode === 'coordinator' ? 'ops' : 'map')
    setFlow(null)
  }, [mode])

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: TabId }>).detail
      if (detail?.tab) setTab(detail.tab)
    }
    window.addEventListener('faro:navigate-tab', listener)
    return () => window.removeEventListener('faro:navigate-tab', listener)
  }, [])

  const openDetail = (site: Site) => {
    setDetailSite(site)
    setFlow(null)
  }

  useEffect(() => {
    if (tab !== 'map' && detailSite) setDetailSite(null)
  }, [tab, detailSite])

  useEffect(() => {
    if (previousNetworkState.current === network.state) return
    if (network.state === 'offline') {
      showToast('Sin conexion. Usando la ultima informacion disponible.', 'warning')
    } else if (network.state === 'online' && previousNetworkState.current !== 'online') {
      showToast('Conexion recuperada.', 'success')
    }
    previousNetworkState.current = network.state
  }, [network.state, showToast])

  const openMenu = () => {
    if (mode === 'citizen') {
      setFlow(null)
      setTab('reports')
      return
    }
    setFlow('menu')
  }

  const handleAction = (action: ActionId) => {
    if (action === 'report') {
      setFlow(null)
      setTab('reports')
      return
    }
    if (action === 'register-need') setNeedPresetSiteId(undefined)
    setFlow(action)
  }

  const openRegisterNeed = (siteId?: string) => {
    setNeedPresetSiteId(siteId)
    setFlow('register-need')
  }

  const openCoordinatorReports = (report?: Report) => {
    setTab('ops')
    setCoordinatorModule('reports')
    setFocusReportId(report?.id ?? null)
    setNotifOpen(false)
  }

  const handleNotifications = () => {
    if (mode === 'coordinator' && coordinatorNotif.enabled) {
      setNotifOpen(true)
      return
    }
    setTab('activity')
  }

  return (
    <div className="faro-canvas min-h-screen w-full bg-[#050A14] lg:p-5">
      <div
        id="faro-shell"
        className="faro-shell relative mx-auto flex h-screen w-full max-w-[1480px] flex-col overflow-hidden bg-base-900 lg:h-[calc(100vh-2.5rem)] lg:flex-row lg:rounded-2xl lg:border lg:border-white/[0.06] lg:shadow-2xl lg:shadow-black/40"
      >
        <div id="faro-portals" aria-hidden="false" />

        <DesktopNavigation
          active={tab}
          onChange={setTab}
          onCreate={openMenu}
          tabs={tabs}
          createLabel={mode === 'coordinator' ? 'Acciones de coordinación' : 'Enviar reporte'}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <EmergencyHeader
            notifications={coordinatorNotif.enabled ? coordinatorNotif.pendingCount : 0}
            onNotifications={handleNotifications}
            connectionState={network.state}
            connectionLabel={network.label}
          />
          <ConnectionBanner state={network.state} label={network.label} cachedAt={cachedAt} />

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab === 'map' && detailSite ? `detail-${detailSite.id}` : tab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="h-full"
              >
                <Suspense fallback={<ScreenLoading />}>
                  {tab === 'ops' && mode === 'coordinator' && (
                    <CoordinatorOpsRoute
                      activeModule={coordinatorModule}
                      onModuleChange={setCoordinatorModule}
                      focusReportId={focusReportId}
                      onFocusReportClear={() => setFocusReportId(null)}
                      onOpenDetail={openDetail}
                      onRegisterNeed={openRegisterNeed}
                      onUpdateSaturation={(siteId) => {
                        setNeedPresetSiteId(siteId)
                        setFlow('update-saturation')
                      }}
                      onRegisterArrival={(siteId) => {
                        setNeedPresetSiteId(siteId)
                        setFlow('register-arrival')
                      }}
                      onRegisterDispatch={(siteId) => {
                        setNeedPresetSiteId(siteId)
                        setFlow('register-dispatch')
                      }}
                    />
                  )}
                  {tab === 'map' &&
                    (detailSite ? (
                      <CenterDetailScreen site={detailSite} onBack={() => setDetailSite(null)} />
                    ) : (
                      <SituationScreen
                        onOpenDetail={openDetail}
                        onRegisterSite={() => setFlow('register-site')}
                      />
                    ))}
                  {tab === 'reports' && <ReportsScreen />}
                  {tab === 'activity' && <ActivityScreen />}
                  {tab === 'profile' && <ProfileScreen />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>

          <BottomNavigation
            active={tab}
            onChange={setTab}
            onCreate={openMenu}
            tabs={tabs}
            createLabel={mode === 'coordinator' ? 'Acciones de coordinación' : 'Enviar reporte'}
          />
        </div>

        <AnimatePresence>
          {flow === 'menu' && (
            <ActionsScreen key="menu" mode={mode} onClose={() => setFlow(null)} onAction={handleAction} />
          )}
          {flow === 'register-site' && <RegisterSiteFlow key="register-site" onClose={() => setFlow(null)} />}
          {flow === 'register-need' && (
            <RegisterNeedFlow key={`register-need-${needPresetSiteId ?? 'any'}`} presetSiteId={needPresetSiteId} onClose={() => setFlow(null)} />
          )}
          {flow === 'update-saturation' && (
            <UpdateSaturationFlow
              key={`update-saturation-${needPresetSiteId ?? 'any'}`}
              presetSiteId={needPresetSiteId}
              onClose={() => setFlow(null)}
            />
          )}
          {flow === 'register-arrival' && (
            <AdjustNeedStockFlow
              key={`register-arrival-${needPresetSiteId ?? 'any'}`}
              mode="arrival"
              presetSiteId={needPresetSiteId}
              onClose={() => setFlow(null)}
            />
          )}
          {flow === 'register-dispatch' && (
            <AdjustNeedStockFlow
              key={`register-dispatch-${needPresetSiteId ?? 'any'}`}
              mode="dispatch"
              presetSiteId={needPresetSiteId}
              onClose={() => setFlow(null)}
            />
          )}
        </AnimatePresence>

        <CoordinatorNotificationsSheet
          open={notifOpen && coordinatorNotif.enabled}
          reports={coordinatorNotif.pendingReports}
          onClose={() => setNotifOpen(false)}
          onOpenReport={(report) => openCoordinatorReports(report)}
          onOpenInbox={() => openCoordinatorReports()}
        />
      </div>
    </div>
  )
}

function CoordinatorOpsRoute({
  activeModule,
  onModuleChange,
  focusReportId,
  onFocusReportClear,
  onOpenDetail,
  onRegisterNeed,
  onUpdateSaturation,
  onRegisterArrival,
  onRegisterDispatch,
}: {
  activeModule: CoordinatorModuleId
  onModuleChange: (module: CoordinatorModuleId) => void
  focusReportId: string | null
  onFocusReportClear: () => void
  onOpenDetail: (site: Site) => void
  onRegisterNeed: (siteId?: string) => void
  onUpdateSaturation: (siteId?: string) => void
  onRegisterArrival: (siteId?: string) => void
  onRegisterDispatch: (siteId?: string) => void
}) {
  const { assignment, loading } = useCoordinatorAssignment()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-ink-muted">
        Cargando panel del coordinador…
      </div>
    )
  }

  if (!assignment) {
    return <CoordinatorSetupScreen />
  }

  return (
    <CoordinatorPanelScreen
      activeModule={activeModule}
      onModuleChange={onModuleChange}
      focusReportId={focusReportId}
      onFocusReportClear={onFocusReportClear}
      onOpenDetail={onOpenDetail}
      onRegisterNeed={onRegisterNeed}
      onUpdateSaturation={onUpdateSaturation}
      onRegisterArrival={onRegisterArrival}
      onRegisterDispatch={onRegisterDispatch}
    />
  )
}
