import { lazy, Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EmergencyHeader } from '@/components/faro/emergency-header'
import { ConnectionBanner } from '@/components/faro/connection-banner'
import { CoordinatorNotificationsSheet } from '@/components/coordinator/coordinator-notifications-sheet'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { UserNotificationSheet } from '@/components/notifications/UserNotificationSheet'
import { RequireRole } from '@/components/auth/require-role'
import { useCoordinatorNotifications } from '@/hooks/useCoordinatorNotifications'
import {
  useAdminNotificationMutations,
  useAdminNotifications,
} from '@/hooks/useAdminNotifications'
import {
  useUserNotificationMutations,
  useUserNotifications,
} from '@/hooks/useUserNotifications'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
import type { Report } from '@/domain/models'
import {
  BottomNavigation,
  DesktopNavigation,
  getNavigationTabs,
  type TabId,
} from '@/components/faro/app-navigation'
import { ActionsScreen, type ActionId } from '@/screens/actions-screen'
import { CreateCenterWizard } from '@/components/admin/create-center-wizard'
import { RegisterNeedFlow } from '@/screens/register-need-flow'
import { UpdateSaturationFlow } from '@/screens/update-saturation-flow'
import { CoordinatorSetupScreen } from '@/screens/coordinator-setup-screen'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useToast } from '@/store/toast-context'
import { useFaro } from '@/store/faro-context'
import { AdjustNeedStockFlow } from '@/screens/adjust-need-stock-flow'
import type { Site } from '@/lib/types'
import { usePermissions, useAuth } from '@/store/auth-context'
import { FARO_ROLES, canAccessSystemPanel } from '@/lib/roles'
import { Skeleton } from '@/components/ui/skeleton'

type FlowId = ActionId | 'menu' | 'auth' | 'coordinator-request'

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
const AdminScreen = lazy(() => import('@/screens/admin-screen').then((m) => ({ default: m.AdminScreen })))
const SystemAdminScreen = lazy(() =>
  import('@/screens/system-admin-screen').then((m) => ({ default: m.SystemAdminScreen })),
)
const AuthScreen = lazy(() => import('@/screens/auth-screen').then((m) => ({ default: m.AuthScreen })))
const CoordinatorRequestScreen = lazy(() =>
  import('@/screens/coordinator-request-screen').then((m) => ({ default: m.CoordinatorRequestScreen })),
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

export function AppShell() {
  const { role, canAccessCoordinatorPanel, canAccessAdminPanel } = usePermissions()
  const { session, pendingAuthIntent, clearPendingAuthIntent, refreshProfile } = useAuth()
  const { cachedAt } = useFaro()
  const [tab, setTab] = useState<TabId>('map')
  const [flow, setFlow] = useState<FlowId | null>(null)
  const [needPresetSiteId, setNeedPresetSiteId] = useState<string | undefined>()
  const [detailSite, setDetailSite] = useState<Site | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [adminNotifOpen, setAdminNotifOpen] = useState(false)
  const [userNotifOpen, setUserNotifOpen] = useState(false)
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null)
  const [coordinatorModule, setCoordinatorModule] = useState<CoordinatorModuleId>('dashboard')
  const [focusReportId, setFocusReportId] = useState<string | null>(null)
  const coordinatorNotif = useCoordinatorNotifications()
  const adminNotif = useAdminNotifications()
  const userNotif = useUserNotifications()
  const { markRead: markAdminRead } = useAdminNotificationMutations()
  const { markRead: markUserRead } = useUserNotificationMutations()
  const network = useNetworkStatus()
  const previousNetworkState = useRef(network.state)
  const { showToast } = useToast()

  const tabs = useMemo(() => getNavigationTabs(role), [role])
  const isCoordinatorOps = canAccessCoordinatorPanel

  const headerNotificationCount = useMemo(() => {
    if (isCoordinatorOps && coordinatorNotif.enabled) return coordinatorNotif.pendingCount
    if (canAccessAdminPanel && adminNotif.enabled) return adminNotif.unreadCount
    if (userNotif.enabled) return userNotif.unreadCount
    return 0
  }, [
    isCoordinatorOps,
    coordinatorNotif.enabled,
    coordinatorNotif.pendingCount,
    canAccessAdminPanel,
    adminNotif.enabled,
    adminNotif.unreadCount,
    userNotif.enabled,
    userNotif.unreadCount,
  ])

  useEffect(() => {
    if (pendingAuthIntent === 'password_recovery') {
      startTransition(() => setFlow('auth'))
    } else if (pendingAuthIntent === 'email_confirmation') {
      showToast('Correo confirmado correctamente.', 'success')
      clearPendingAuthIntent()
    }
  }, [pendingAuthIntent, clearPendingAuthIntent, showToast])

  // Cerrar el flujo de auth automáticamente cuando llega la sesión
  // (captura el caso de confirmación de correo en otra pestaña/navegador).
  useEffect(() => {
    if (session && flow === 'auth') {
      startTransition(() => setFlow(null))
    }
  }, [session, flow])

  useEffect(() => {
    const allowed = tabs.map((t) => t.id)
    if (!allowed.includes(tab)) setTab('map')
  }, [tabs, tab])

  // Fallback: si hay notificación de aprobación pero el JWT aún no refleja el rol.
  useEffect(() => {
    if (role !== FARO_ROLES.PUBLIC || !userNotif.data?.length) return
    const approved = userNotif.data.some((n) => n.type === 'coordinator_request_approved')
    if (approved) void refreshProfile()
  }, [userNotif.data, role, refreshProfile])

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: TabId; requestId?: string }>).detail
      if (detail?.tab) setTab(detail.tab)
      if (detail?.requestId) setFocusRequestId(detail.requestId)
    }
    window.addEventListener('faro:navigate-tab', listener)
    return () => window.removeEventListener('faro:navigate-tab', listener)
  }, [])

  const openDetail = (site: Site) => {
    setDetailSite(site)
    closeFlow()
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

  const openFlow = useCallback((next: FlowId) => {
    startTransition(() => setFlow(next))
  }, [])

  const closeFlow = useCallback(() => {
    startTransition(() => setFlow(null))
  }, [])

  const openMenu = () => {
    if (isCoordinatorOps || canAccessAdminPanel) {
      openFlow('menu')
      return
    }
    closeFlow()
    setTab('reports')
  }

  const handleAction = (action: ActionId) => {
    if (action === 'report') {
      closeFlow()
      setTab('reports')
      return
    }
    if (action === 'register-need') setNeedPresetSiteId(undefined)
    openFlow(action)
  }

  const openRegisterNeed = (siteId?: string) => {
    setNeedPresetSiteId(siteId)
    openFlow('register-need')
  }

  const openCoordinatorReports = (report?: Report) => {
    setTab('ops')
    setCoordinatorModule('reports')
    setFocusReportId(report?.id ?? null)
    setNotifOpen(false)
  }

  const openAdminRequest = (requestId: string) => {
    setTab('admin')
    setFocusRequestId(requestId)
    setAdminNotifOpen(false)
  }

  const openSystemUsers = () => {
    setTab('system')
    setAdminNotifOpen(false)
  }

  const handleNotifications = () => {
    if (isCoordinatorOps && coordinatorNotif.enabled) {
      setNotifOpen(true)
      return
    }
    if (canAccessAdminPanel && adminNotif.enabled) {
      setAdminNotifOpen(true)
      return
    }
    if (userNotif.enabled && userNotif.unreadCount > 0) {
      setUserNotifOpen(true)
      return
    }
    if (userNotif.enabled) {
      setUserNotifOpen(true)
      return
    }
    setTab('activity')
  }

  const openUserCoordinatorRequest = () => {
    setUserNotifOpen(false)
    openFlow('coordinator-request')
  }

  const openCoordinatorOpsFromNotification = () => {
    setUserNotifOpen(false)
    void refreshProfile()
    setTab('ops')
  }

  const openAuth = () => openFlow('auth')
  const openCoordinatorRequest = () => openFlow('coordinator-request')

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
          createLabel={
            isCoordinatorOps
              ? 'Acciones de coordinación'
              : canAccessAdminPanel
                ? 'Menú de administración'
                : 'Enviar reporte'
          }
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <EmergencyHeader
            notifications={headerNotificationCount}
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
                  {tab === 'ops' && (
                    <RequireRole
                      allowed={[FARO_ROLES.COORDINATOR]}
                      onRequestAuth={openAuth}
                    >
                      <CoordinatorOpsRoute
                        activeModule={coordinatorModule}
                        onModuleChange={setCoordinatorModule}
                        focusReportId={focusReportId}
                        onFocusReportClear={() => setFocusReportId(null)}
                        onOpenDetail={openDetail}
                        onRegisterNeed={openRegisterNeed}
                        onUpdateSaturation={(siteId) => {
                          setNeedPresetSiteId(siteId)
                          openFlow('update-saturation')
                        }}
                        onRegisterArrival={(siteId) => {
                          setNeedPresetSiteId(siteId)
                          openFlow('register-arrival')
                        }}
                        onRegisterDispatch={(siteId) => {
                          setNeedPresetSiteId(siteId)
                          openFlow('register-dispatch')
                        }}
                        onRequestAuth={openAuth}
                        onRequestCoordinatorAccess={openCoordinatorRequest}
                      />
                    </RequireRole>
                  )}
                  {tab === 'map' &&
                    (detailSite ? (
                      <CenterDetailScreen
                        site={detailSite}
                        onBack={() => setDetailSite(null)}
                        canEdit={canAccessAdminPanel}
                      />
                    ) : (
                      <SituationScreen
                        onOpenDetail={openDetail}
                        onRegisterSite={
                          canAccessAdminPanel ? () => openFlow('register-site') : undefined
                        }
                      />
                    ))}
                  {tab === 'reports' && <ReportsScreen />}
                  {tab === 'activity' && <ActivityScreen />}
                  {tab === 'profile' && (
                    <ProfileScreen
                      onRequestAuth={openAuth}
                      onRequestCoordinatorAccess={openCoordinatorRequest}
                    />
                  )}
                  {tab === 'admin' && (
                    <AdminScreen
                      onRequestAuth={openAuth}
                      focusRequestId={focusRequestId}
                      onFocusRequestClear={() => setFocusRequestId(null)}
                    />
                  )}
                  {tab === 'system' && <SystemAdminScreen onRequestAuth={openAuth} />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>

          <BottomNavigation
            active={tab}
            onChange={setTab}
            onCreate={openMenu}
            createLabel={
              isCoordinatorOps
                ? 'Acciones de coordinación'
                : canAccessAdminPanel
                  ? 'Menú de administración'
                  : 'Enviar reporte'
            }
          />
        </div>

        <AnimatePresence>
          {flow === 'menu' && (
            <ActionsScreen
              key="menu"
              mode={
                isCoordinatorOps ? 'coordinator' : canAccessAdminPanel ? 'admin' : 'citizen'
              }
              onClose={closeFlow}
              onAction={handleAction}
              onNavigate={setTab}
              showSystem={canAccessSystemPanel(role)}
            />
          )}
          {flow === 'auth' && (
            <div key="auth" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <AuthScreen onClose={closeFlow} />
              </Suspense>
            </div>
          )}
          {flow === 'coordinator-request' && (
            <div key="coordinator-request" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <CoordinatorRequestScreen onNeedAuth={openAuth} onClose={closeFlow} />
              </Suspense>
            </div>
          )}
          {flow === 'register-site' && canAccessAdminPanel && (
            <CreateCenterWizard key="register-site" onClose={closeFlow} />
          )}
          {flow === 'register-need' && isCoordinatorOps && (
            <RegisterNeedFlow
              key={`register-need-${needPresetSiteId ?? 'any'}`}
              presetSiteId={needPresetSiteId}
              onClose={closeFlow}
            />
          )}
          {flow === 'update-saturation' && isCoordinatorOps && (
            <UpdateSaturationFlow
              key={`update-saturation-${needPresetSiteId ?? 'any'}`}
              presetSiteId={needPresetSiteId}
              onClose={closeFlow}
            />
          )}
          {flow === 'register-arrival' && isCoordinatorOps && (
            <AdjustNeedStockFlow
              key={`register-arrival-${needPresetSiteId ?? 'any'}`}
              mode="arrival"
              presetSiteId={needPresetSiteId}
              onClose={closeFlow}
            />
          )}
          {flow === 'register-dispatch' && isCoordinatorOps && (
            <AdjustNeedStockFlow
              key={`register-dispatch-${needPresetSiteId ?? 'any'}`}
              mode="dispatch"
              presetSiteId={needPresetSiteId}
              onClose={closeFlow}
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

        <NotificationCenter
          open={adminNotifOpen && adminNotif.enabled}
          notifications={adminNotif.data ?? []}
          loading={adminNotif.isLoading}
          onClose={() => setAdminNotifOpen(false)}
          onOpenRequest={openAdminRequest}
          onOpenSystem={openSystemUsers}
          onMarkRead={(id) => void markAdminRead.mutate(id)}
        />

        <UserNotificationSheet
          open={userNotifOpen && userNotif.enabled}
          notifications={userNotif.data ?? []}
          loading={userNotif.isLoading}
          onClose={() => setUserNotifOpen(false)}
          onOpenRequest={openUserCoordinatorRequest}
          onGoToCoordinatorOps={openCoordinatorOpsFromNotification}
          onMarkRead={(id) => void markUserRead.mutate(id)}
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
  onRequestAuth,
  onRequestCoordinatorAccess,
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
  onRequestAuth: () => void
  onRequestCoordinatorAccess: () => void
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
    return (
      <CoordinatorSetupScreen
        onRequestAuth={onRequestAuth}
        onRequestCoordinatorAccess={onRequestCoordinatorAccess}
      />
    )
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
