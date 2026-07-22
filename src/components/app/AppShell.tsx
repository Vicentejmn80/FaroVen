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
  getMobilePrimaryTabs,
  getNavigationTabs,
  normalizeTabId,
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
import { ROLE_LABELS } from '@/services/dev-service'
import { FARO_ROLES, type FaroRole } from '@/lib/roles'
import { RequireRole } from '@/components/auth/require-role'
import { refreshNeedCycles } from '@/services/repository-service'
import { NeedCycleClosureModal } from '@/components/coordinator/need-cycle-closure-modal'
import { Skeleton } from '@/components/ui/skeleton'
import type { NotificationRow } from '@/domain/notification-models'
import { PendingRoleBanner } from '@/components/auth/pending-role-banner'

type FlowId =
  | ActionId
  | 'menu'
  | 'auth'
  | 'coordinator-request'
  | 'role-request'
  | 'create-case'
  | 'legal-terms'
  | 'legal-privacy'
  | 'legal-notice'
  | 'legal-cookies'
  | 'legal-contact'
  | 'legal-about'

const SituationScreen = lazyWithRetry(() =>
  import('@/screens/situation-screen').then((m) => ({ default: m.SituationScreen })),
)
const OperationsHub = lazyWithRetry(() =>
  import('@/components/operations-hub/operations-hub').then((m) => ({ default: m.OperationsHub })),
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
const CreateCaseForm = lazyWithRetry(() =>
  import('@/components/case-manager/create-case-form').then((m) => ({ default: m.CreateCaseForm })),
)
const CaseManagerWorkspace = lazyWithRetry(() =>
  import('@/components/case-manager/case-manager-workspace').then((m) => ({ default: m.CaseManagerWorkspace })),
)
const RoleRequestForm = lazyWithRetry(() =>
  import('@/components/role-request/role-request-form').then((m) => ({ default: m.RoleRequestForm })),
)
const LegalTermsScreen = lazyWithRetry(() =>
  import('@/screens/legal-terms-screen').then((m) => ({ default: m.LegalTermsScreen })),
)
const LegalPrivacyScreen = lazyWithRetry(() =>
  import('@/screens/legal-privacy-screen').then((m) => ({ default: m.LegalPrivacyScreen })),
)
const LegalNoticeScreen = lazyWithRetry(() =>
  import('@/screens/legal-notice-screen').then((m) => ({ default: m.LegalNoticeScreen })),
)
const LegalCookiesScreen = lazyWithRetry(() =>
  import('@/screens/legal-cookies-screen').then((m) => ({ default: m.LegalCookiesScreen })),
)
const ContactScreen = lazyWithRetry(() =>
  import('@/screens/contact-screen').then((m) => ({ default: m.ContactScreen })),
)
const AboutFaroScreen = lazyWithRetry(() =>
  import('@/screens/about-faro-screen').then((m) => ({ default: m.AboutFaroScreen })),
)
const VolunteerNeedsScreen = lazyWithRetry(() =>
  import('@/screens/volunteer-needs-screen').then((m) => ({ default: m.VolunteerNeedsScreen })),
)
const VolunteerCollaborationsScreen = lazyWithRetry(() =>
  import('@/screens/volunteer-collaborations-screen').then((m) => ({
    default: m.VolunteerCollaborationsScreen,
  })),
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
  const { role, canAccessCoordinatorPanel, canAccessAdminPanel, canAccessSystemPanel, isVolunteer } =
    usePermissions()
  const { session, user, pendingAuthIntent, clearPendingAuthIntent, refreshProfile, simulatedRole, setSimulatedRole } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { cachedAt, sites, state } = useFaro()
  const [activeView, setActiveViewState] = useState<TabId>(isVolunteer ? 'needs' : 'map')
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
  const mobileTabs = useMemo(() => getMobilePrimaryTabs(role, user?.email), [role, user?.email])
  const isCoordinatorOps = canAccessCoordinatorPanel
  const isCaseManager = role === FARO_ROLES.CASE_MANAGER
  const defaultTab: TabId = isVolunteer ? 'needs' : 'map'

  const actionsMode = isCoordinatorOps
    ? ('coordinator' as const)
    : canAccessAdminPanel
      ? ('admin' as const)
      : isCaseManager
        ? ('case_manager' as const)
        : isVolunteer
          ? ('volunteer' as const)
          : ('citizen' as const)

  const fabContext = useMemo(() => {
    const labels = {
      coordinator: 'Acciones de coordinación',
      admin: 'Menú de administración',
      case_manager: 'Acción operativa',
      volunteer: 'Acción rápida',
      citizen: 'Acción rápida',
    } as const
    // El FAB siempre dispara ActionsScreen con acciones reales por rol.
    // Nunca se deja como adorno: si la vista no aporta valor extra, el menú
    // sigue ofreciendo reportar / crear caso / registrar necesidad, etc.
    return { show: true as const, label: labels[actionsMode] }
  }, [actionsMode])

  /** Navegación manual: una sola vista activa; limpia detalle al salir del mapa. */
  const setActiveView = useCallback((next: TabId) => {
    const view = normalizeTabId(next) ?? next
    setActiveViewState(view)
    if (view !== 'map') setDetailSite(null)
  }, [])

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
    const allowed = new Set(tabs.map((t) => t.id))
    const current = normalizeTabId(activeView) ?? activeView
    if (!allowed.has(current)) setActiveView(defaultTab)
  }, [tabs, activeView, defaultTab, setActiveView])

  // Fallback: si hay notificación de aprobación pero el JWT aún no refleja el rol.
  useEffect(() => {
    if (role !== FARO_ROLES.PUBLIC || !notifications.data?.length) return
    const approved = notifications.data.some((n) => n.type === 'coordinator_request_approved')
    if (approved) void refreshProfile()
  }, [notifications.data, role, refreshProfile])

  const applyNotificationNavigation = useCallback((target: NotificationNavigationTarget) => {
    if (target.tab) setActiveView(target.tab)
    if (target.focusRequestId) setFocusRequestId(target.focusRequestId)
    if (target.focusReportId) {
      setFocusReportId(target.focusReportId)
      setCoordinatorModule('reports')
    }
    if (target.coordinatorModule) setCoordinatorModule(target.coordinatorModule)
    if (target.flow === 'coordinator-request') startTransition(() => setFlow('coordinator-request'))
    setHubOpen(false)
  }, [setActiveView])

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
    if (activeView !== 'map' && detailSite) setDetailSite(null)
  }, [activeView, detailSite])

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

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ doc?: string }>).detail
      if (!detail?.doc) return
      if (detail.doc === 'terms') openFlow('legal-terms')
      if (detail.doc === 'privacy') openFlow('legal-privacy')
      if (detail.doc === 'notice') openFlow('legal-notice')
      if (detail.doc === 'cookies') openFlow('legal-cookies')
      if (detail.doc === 'contact') openFlow('legal-contact')
      if (detail.doc === 'about') openFlow('legal-about')
    }
    window.addEventListener('faro:open-legal', listener)
    return () => window.removeEventListener('faro:open-legal', listener)
  }, [openFlow])

  const openMenu = () => {
    openFlow('menu')
  }

  const handleAction = (action: ActionId) => {
    if (action === 'report') {
      closeFlow()
      setActiveView('reports')
      return
    }
    if (action === 'create-case') {
      openFlow('create-case')
      return
    }
    if (action === 'assign-resource') {
      closeFlow()
      setActiveView('map')
      showToast('Selecciona un caso en el pipeline para asignar un centro o recurso.', 'info')
      return
    }
    if (action === 'register-need') {
      if (isCoordinatorOps) {
        setNeedPresetSiteId(undefined)
        openFlow('register-need')
        return
      }
      closeFlow()
      setActiveView('reports')
      showToast('Describe la necesidad en tu reporte. El gestor la convertirá en caso.', 'info')
      return
    }
    openFlow(action)
  }

  const openRegisterNeed = (siteId?: string) => {
    setNeedPresetSiteId(siteId)
    openFlow('register-need')
  }

  useEffect(() => {
    if (activeView !== 'profile') setProfileSubview('main')
  }, [activeView])

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
      setActiveView('profile')
      setProfileSubview('notification-preferences')
    }
    window.addEventListener('faro:open-notification-preferences', openPrefs)
    return () => window.removeEventListener('faro:open-notification-preferences', openPrefs)
  }, [setActiveView])

  const openSystemUsers = () => {
    setActiveView('system')
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
      setActiveView('ops')
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
    setActiveView(isVolunteer ? 'collaborations' : 'activity')
  }

  const viewKey =
    activeView === 'map' && detailSite ? `detail-${detailSite.id}` : (normalizeTabId(activeView) ?? activeView)

  const openAuth = () => openFlow('auth')
  const openCoordinatorRequest = () => openFlow('coordinator-request')
  const openRoleRequest = () => openFlow('role-request')

  return (
    <div className="faro-canvas min-h-screen w-full bg-[#050A14] lg:p-5">
      <div
        id="faro-shell"
        className="faro-shell relative mx-auto flex h-screen w-full max-w-[1480px] flex-col overflow-hidden bg-base-900 lg:h-[calc(100vh-2.5rem)] lg:flex-row lg:rounded-2xl lg:border lg:border-white/[0.06] lg:shadow-2xl lg:shadow-black/40"
      >
        <div id="faro-portals" aria-hidden="false" />

        <DesktopNavigation
          active={activeView}
          onChange={setActiveView}
          onCreate={openMenu}
          tabs={tabs}
          createLabel={fabContext.label}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PendingRoleBanner />
          <EmergencyHeader
            notifications={headerNotificationCount}
            onNotifications={handleNotifications}
            connectionState={network.state}
            connectionLabel={network.label}
          />
          <ConnectionBanner state={network.state} label={network.label} cachedAt={cachedAt} />

          {simulatedRole && (
            <div className="mx-4 mt-2 flex items-center justify-between rounded-2xl border border-info/30 bg-info/10 px-3 py-2">
              <span className="text-xs text-info">
                Simulación activa — Viendo interfaz de: <strong>{ROLE_LABELS[simulatedRole]}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSimulatedRole(null)}
                className="text-xs font-medium text-info underline"
              >
                Salir
              </button>
            </div>
          )}

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={viewKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="h-full min-h-0"
              >
                <ScreenErrorBoundary screenName="la pantalla" resetKey={viewKey}>
                  <Suspense fallback={<ScreenLoading />}>
                    <ShellActiveView
                      activeView={activeView}
                      role={role}
                      detailSite={detailSite}
                      profileSubview={profileSubview}
                      canAccessAdminPanel={canAccessAdminPanel}
                      coordinatorModule={coordinatorModule}
                      focusReportId={focusReportId}
                      focusRequestId={focusRequestId}
                      onModuleChange={setCoordinatorModule}
                      onFocusReportClear={() => setFocusReportId(null)}
                      onFocusRequestClear={() => setFocusRequestId(null)}
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
                      onRequestRoleAccess={openRoleRequest}
                      onBackFromDetail={() => setDetailSite(null)}
                      onRegisterSite={
                        canAccessAdminPanel ? () => openFlow('register-site') : undefined
                      }
                      onOpenNotificationPreferences={() => setProfileSubview('notification-preferences')}
                      onBackFromNotificationPrefs={() => setProfileSubview('main')}
                      onNavigate={setActiveView}
                      onOpenMapSite={(siteId) => {
                        const site = sites.find((item) => item.id === siteId) ?? null
                        setDetailSite(site)
                        setActiveViewState('map')
                      }}
                      onOfferHelp={() => {
                        setDetailSite(null)
                        setActiveView('map')
                        showToast('Elige una necesidad activa en el mapa para ofrecer ayuda.', 'info')
                      }}
                    />
                  </Suspense>
                </ScreenErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>

          <BottomNavigation
            active={activeView}
            onChange={setActiveView}
            onCreate={openMenu}
            mobileTabs={mobileTabs}
            createLabel={fabContext.label}
          />
        </div>

        <AnimatePresence>
          {flow === 'menu' && (
            <ActionsScreen
              key="menu"
              mode={actionsMode}
              onClose={closeFlow}
              onAction={handleAction}
              onNavigate={setActiveView}
              showSystem={canAccessSystemPanel}
            />
          )}
          {flow === 'create-case' && isCaseManager && (
            <Suspense key="create-case" fallback={<ScreenLoading />}>
              <CreateCaseForm onClose={closeFlow} />
            </Suspense>
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
          {flow === 'role-request' && (
            <div key="role-request" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <div className="mx-auto max-w-lg px-4 py-8">
                  <RoleRequestForm onDone={closeFlow} />
                </div>
              </Suspense>
            </div>
          )}
          {flow === 'legal-terms' && (
            <div key="legal-terms" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <LegalTermsScreen onBack={closeFlow} />
              </Suspense>
            </div>
          )}
          {flow === 'legal-privacy' && (
            <div key="legal-privacy" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <LegalPrivacyScreen onBack={closeFlow} />
              </Suspense>
            </div>
          )}
          {flow === 'legal-notice' && (
            <div key="legal-notice" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <LegalNoticeScreen onBack={closeFlow} />
              </Suspense>
            </div>
          )}
          {flow === 'legal-cookies' && (
            <div key="legal-cookies" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <LegalCookiesScreen onBack={closeFlow} />
              </Suspense>
            </div>
          )}
          {flow === 'legal-contact' && (
            <div key="legal-contact" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <ContactScreen onBack={closeFlow} />
              </Suspense>
            </div>
          )}
          {flow === 'legal-about' && (
            <div key="legal-about" className="absolute inset-0 z-[60] overflow-y-auto bg-base-900">
              <Suspense fallback={<ScreenLoading />}>
                <AboutFaroScreen onBack={closeFlow} />
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

/**
 * Renderizado exclusivo por activeView (sin solapar pantallas).
 * Navegación manual FARO — no usa react-router.
 */
function ShellActiveView({
  activeView,
  role,
  detailSite,
  profileSubview,
  canAccessAdminPanel,
  coordinatorModule,
  focusReportId,
  focusRequestId,
  onModuleChange,
  onFocusReportClear,
  onFocusRequestClear,
  onOpenDetail,
  onRegisterNeed,
  onUpdateSaturation,
  onRegisterArrival,
  onRegisterDispatch,
  onRequestAuth,
  onRequestCoordinatorAccess,
  onRequestRoleAccess,
  onBackFromDetail,
  onRegisterSite,
  onOpenNotificationPreferences,
  onBackFromNotificationPrefs,
  onNavigate,
  onOpenMapSite,
  onOfferHelp,
}: {
  activeView: TabId
  role: FaroRole
  detailSite: Site | null
  profileSubview: ProfileSubview
  canAccessAdminPanel: boolean
  coordinatorModule: CoordinatorModuleId
  focusReportId: string | null
  focusRequestId: string | null
  onModuleChange: (module: CoordinatorModuleId) => void
  onFocusReportClear: () => void
  onFocusRequestClear: () => void
  onOpenDetail: (site: Site) => void
  onRegisterNeed: (siteId?: string) => void
  onUpdateSaturation: (siteId?: string) => void
  onRegisterArrival: (siteId?: string) => void
  onRegisterDispatch: (siteId?: string) => void
  onRequestAuth: () => void
  onRequestCoordinatorAccess: () => void
  onRequestRoleAccess: () => void
  onBackFromDetail: () => void
  onRegisterSite?: () => void
  onOpenNotificationPreferences: () => void
  onBackFromNotificationPrefs: () => void
  onNavigate: (view: TabId) => void
  onOpenMapSite: (siteId: string) => void
  onOfferHelp: () => void
}) {
  const view = normalizeTabId(activeView) ?? activeView

  switch (view) {
    case 'map':
      if (role === FARO_ROLES.CASE_MANAGER) {
        return (
          <RequireRole allowed={[FARO_ROLES.CASE_MANAGER]} onRequestAuth={onRequestAuth}>
            <OperationsHub />
          </RequireRole>
        )
      }
      return detailSite ? (
        <CenterDetailScreen
          site={detailSite}
          onBack={onBackFromDetail}
          canEdit={canAccessAdminPanel}
          onReport={() => {
            onBackFromDetail()
            onNavigate('reports')
          }}
        />
      ) : (
        <SituationScreen onOpenDetail={onOpenDetail} onRegisterSite={onRegisterSite} />
      )

    case 'needs':
      return (
        <VolunteerNeedsScreen
          onViewMap={() => onNavigate('map')}
          onOfferHelp={onOfferHelp}
          onMyCollaborations={() => onNavigate('collaborations')}
          onOpenSite={onOpenMapSite}
        />
      )

    case 'collaborations':
      return (
        <VolunteerCollaborationsScreen
          onBrowseNeeds={() => onNavigate('needs')}
          onOpenMap={() => onNavigate('map')}
        />
      )

    case 'reports':
      return <ReportsScreen />

    case 'activity':
      return <ActivityScreen />

    case 'profile':
      return profileSubview === 'notification-preferences' ? (
        <NotificationPreferencesScreen onBack={onBackFromNotificationPrefs} />
      ) : (
        <ProfileScreen
          onRequestAuth={onRequestAuth}
          onRequestCoordinatorAccess={onRequestCoordinatorAccess}
          onRequestRoleAccess={onRequestRoleAccess}
          onOpenNotificationPreferences={onOpenNotificationPreferences}
        />
      )

    case 'ops':
      return (
        <RequireRole allowed={[FARO_ROLES.COORDINATOR]} onRequestAuth={onRequestAuth}>
          <CoordinatorOpsRoute
            activeModule={coordinatorModule}
            onModuleChange={onModuleChange}
            focusReportId={focusReportId}
            onFocusReportClear={onFocusReportClear}
            onOpenDetail={onOpenDetail}
            onRegisterNeed={onRegisterNeed}
            onUpdateSaturation={onUpdateSaturation}
            onRegisterArrival={onRegisterArrival}
            onRegisterDispatch={onRegisterDispatch}
            onRequestAuth={onRequestAuth}
            onRequestCoordinatorAccess={onRequestCoordinatorAccess}
          />
        </RequireRole>
      )

    case 'case-manager':
      return (
        <RequireRole allowed={[FARO_ROLES.CASE_MANAGER]} onRequestAuth={onRequestAuth}>
          <CaseManagerWorkspace />
        </RequireRole>
      )

    case 'admin':
      return (
        <AdminScreen
          onRequestAuth={onRequestAuth}
          focusRequestId={focusRequestId}
          onFocusRequestClear={onFocusRequestClear}
        />
      )

    case 'system':
      return <SystemAdminScreen onRequestAuth={onRequestAuth} />

    default:
      return (
        <div className="flex h-full items-center justify-center px-6 text-sm text-ink-muted">
          Vista no disponible.
        </div>
      )
  }
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
