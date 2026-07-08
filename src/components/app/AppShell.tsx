import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import { AnimatePresence, motion } from 'framer-motion'
import { EmergencyHeader } from '@/components/faro/emergency-header'
import { ConnectionBanner } from '@/components/faro/connection-banner'
import { NotificationHub } from '@/components/notifications/NotificationHub'
import { PushPermissionModal } from '@/components/notifications/PushPermissionModal'
import { ScreenErrorBoundary } from '@/components/app/ScreenErrorBoundary'
import { useNotifications, useNotificationMutations } from '@/hooks/useNotifications'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { ProfileScreen } from '@/screens/profile-screen'
import { NotificationPreferencesScreen } from '@/screens/notification-preferences-screen'
import {
  parseNavQueryParam,
  parseNotificationActionUrl,
  type NotificationNavigationTarget,
} from '@/lib/notification-routing'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
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
import { FARO_ROLES } from '@/lib/roles'
import { RequireRole } from '@/components/auth/require-role'
import { refreshNeedCycles } from '@/services/repository-service'
import { NeedCycleClosureModal } from '@/components/coordinator/need-cycle-closure-modal'
import { Skeleton } from '@/components/ui/skeleton'
import type { NotificationRow } from '@/domain/notification-models'

type FlowId = ActionId | 'menu' | 'auth' | 'coordinator-request'

const SituationScreen = lazyWithRetry(() =>
  import('@/screens/situation-screen').then((m) => ({ default: m.SituationScreen })),
)
const ActivityScreen = lazyWithRetry(() =>
  import('@/screens/activity-screen').then((m) => ({ default: m.ActivityScreen })),
)
const ReportsScreen = lazyWithRetry(() =>
  import('@/screens/reports-screen').then((m) => ({ default: m.ReportsScreen })),
)
const CenterDetailScreen = lazyWithRetry(() =>
  import('@/screens/center-detail-screen').then((m) => ({ default: m.CenterDetailScreen })),
)
const CoordinatorPanelScreen = lazyWithRetry(() =>
  import('@/screens/coordinator-panel-screen').then((m) => ({ default: m.CoordinatorPanelScreen })),
)
const AdminScreen = lazyWithRetry(() => import('@/screens/admin-screen').then((m) => ({ default: m.AdminScreen })))
const SystemAdminScreen = lazyWithRetry(() =>
  import('@/screens/system-admin-screen').then((m) => ({ default: m.SystemAdminScreen })),
)
const AuthScreen = lazyWithRetry(() => import('@/screens/auth-screen').then((m) => ({ default: m.AuthScreen })))
const CoordinatorRequestScreen = lazyWithRetry(() =>
  import('@/screens/coordinator-request-screen').then((m) => ({ default: m.CoordinatorRequestScreen })),
)

type ProfileSubview = 'main' | 'notification-preferences'

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
  const { role, canAccessCoordinatorPanel, canAccessAdminPanel, canAccessSystemPanel } = usePermissions()
  const { session, user, pendingAuthIntent, clearPendingAuthIntent, refreshProfile } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { cachedAt } = useFaro()
  const { state } = useFaro()
  const [tab, setTab] = useState<TabId>('map')
  const [flow, setFlow] = useState<FlowId | null>(null)
  const [needPresetSiteId, setNeedPresetSiteId] = useState<string | undefined>()
  const [detailSite, setDetailSite] = useState<Site | null>(null)
  const [hubOpen, setHubOpen] = useState(false)
  const [profileSubview, setProfileSubview] = useState<ProfileSubview>('main')
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null)
  const [coordinatorModule, setCoordinatorModule] = useState<CoordinatorModuleId>('dashboard')
  const [focusReportId, setFocusReportId] = useState<string | null>(null)
  const notifications = useNotifications()
  const { markRead, markAllRead, remove } = useNotificationMutations()
  const pushNotif = usePushNotifications()
  const network = useNetworkStatus()
  const previousNetworkState = useRef(network.state)
  const { showToast } = useToast()

  const tabs = useMemo(() => getNavigationTabs(role, user?.email), [role, user?.email])
  const isCoordinatorOps = canAccessCoordinatorPanel
  const pendingClosures = useMemo(() => {
    if (!isCoordinatorOps || !assignment?.siteId) return []
    return state.needs.filter(
      (need) => need.centerId === assignment.siteId && need.status === 'pending_closure',
    )
  }, [assignment?.siteId, isCoordinatorOps, state.needs])

  const headerNotificationCount = useMemo(() => {
    if (session && notifications.enabled) return notifications.unreadCount
    return 0
  }, [session, notifications.enabled, notifications.unreadCount])

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
    if (role !== FARO_ROLES.PUBLIC || !notifications.data?.length) return
    const approved = notifications.data.some((n) => n.type === 'coordinator_request_approved')
    if (approved) void refreshProfile()
  }, [notifications.data, role, refreshProfile])

  const applyNotificationNavigation = useCallback((target: NotificationNavigationTarget) => {
    if (target.tab) setTab(target.tab)
    if (target.focusRequestId) setFocusRequestId(target.focusRequestId)
    if (target.focusReportId) {
      setFocusReportId(target.focusReportId)
      setCoordinatorModule('reports')
    }
    if (target.coordinatorModule) setCoordinatorModule(target.coordinatorModule)
    if (target.flow === 'coordinator-request') startTransition(() => setFlow('coordinator-request'))
    setHubOpen(false)
  }, [])

  useEffect(() => {
    const target = parseNavQueryParam(window.location.search)
    if (target) {
      applyNotificationNavigation(target)
      const url = new URL(window.location.href)
      url.searchParams.delete('nav')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [applyNotificationNavigation])

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<NotificationNavigationTarget>).detail
      if (detail) applyNotificationNavigation(detail)
    }
    window.addEventListener('faro:notification-navigate', listener)
    return () => window.removeEventListener('faro:notification-navigate', listener)
  }, [applyNotificationNavigation])

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

  useEffect(() => {
    if (tab !== 'profile') setProfileSubview('main')
  }, [tab])

  useEffect(() => {
    if (!session || !isCoordinatorOps) return
    let active = true

    const refresh = async () => {
      try {
        await refreshNeedCycles()
      } catch {
        // noop: ciclo se refresca en el siguiente intento
      }
    }

    void refresh()
    const timer = setInterval(() => {
      if (active) void refresh()
    }, 5 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session, isCoordinatorOps])

  useEffect(() => {
    const openPrefs = () => {
      setTab('profile')
      setProfileSubview('notification-preferences')
    }
    window.addEventListener('faro:open-notification-preferences', openPrefs)
    return () => window.removeEventListener('faro:open-notification-preferences', openPrefs)
  }, [])

  const openSystemUsers = () => {
    setTab('system')
    setHubOpen(false)
  }

  const handleNotificationAction = (notification: NotificationRow) => {
    const target = parseNotificationActionUrl(notification.action_url)
    if (target) {
      applyNotificationNavigation(target)
      return
    }
    if (notification.type === 'user_signup') {
      openSystemUsers()
      return
    }
    if (notification.type === 'coordinator_request_approved') {
      void refreshProfile()
      setTab('ops')
      setHubOpen(false)
      return
    }
    if (
      notification.type === 'coordinator_info_request' ||
      notification.type === 'coordinator_request_rejected'
    ) {
      startTransition(() => setFlow('coordinator-request'))
      setHubOpen(false)
    }
  }

  const handleNotifications = () => {
    if (session && notifications.enabled) {
      setHubOpen(true)
      return
    }
    setTab('activity')
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
                className="h-full min-h-0"
              >
                <ScreenErrorBoundary
                  screenName="la pantalla"
                  resetKey={tab === 'map' && detailSite ? `detail-${detailSite.id}` : tab}
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
                  {tab === 'profile' &&
                    (profileSubview === 'notification-preferences' ? (
                      <NotificationPreferencesScreen onBack={() => setProfileSubview('main')} />
                    ) : (
                      <ProfileScreen
                        onRequestAuth={openAuth}
                        onRequestCoordinatorAccess={openCoordinatorRequest}
                        onOpenNotificationPreferences={() => setProfileSubview('notification-preferences')}
                      />
                    ))}
                  {tab === 'admin' && (
                    <AdminScreen
                      onRequestAuth={openAuth}
                      focusRequestId={focusRequestId}
                      onFocusRequestClear={() => setFocusRequestId(null)}
                    />
                  )}
                  {tab === 'system' && <SystemAdminScreen onRequestAuth={openAuth} />}
                  </Suspense>
                </ScreenErrorBoundary>
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
              showSystem={canAccessSystemPanel}
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
          {flow === 'update-saturation' && (isCoordinatorOps || canAccessAdminPanel) && (
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

        <NotificationHub
          open={hubOpen && notifications.enabled}
          notifications={notifications.data ?? []}
          loading={notifications.isLoading}
          pushAvailable={pushNotif.available}
          onClose={() => setHubOpen(false)}
          onMarkRead={(id) => void markRead.mutate(id)}
          onMarkAllRead={() => void markAllRead.mutate()}
          onDelete={(id) => void remove.mutate(id)}
          onAction={handleNotificationAction}
          onEnablePush={pushNotif.openPermissionModal}
        />

        <PushPermissionModal
          open={pushNotif.modalOpen}
          loading={pushNotif.accepting}
          onAccept={() => void pushNotif.acceptPush()}
          onDismiss={pushNotif.dismissModal}
        />

        {pendingClosures.length > 0 && (
          <NeedCycleClosureModal
            needs={pendingClosures}
            centerName={assignment?.siteName}
          />
        )}
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
