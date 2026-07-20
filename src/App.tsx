import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'

import { RoleGuard } from '@/components/auth/role-guard'

import { PushDebugPanel } from '@/components/dev/PushDebugPanel'

import { PwaDiagnosticsPanel } from '@/components/dev/PwaDiagnosticsPanel'

import { HelpCenterSheet } from '@/components/onboarding/HelpCenterSheet'

import { InitialOnboardingFlow } from '@/components/onboarding/InitialOnboardingFlow'

import { PwaUpdateBanner } from '@/components/pwa/PwaUpdateBanner'

import { useOnboardingGate } from '@/hooks/useOnboardingGate'

import { useAuth, usePermissions } from '@/store/auth-context'



const PublicPortalScreen = lazy(() =>

  import('@/screens/public-portal-screen').then((m) => ({ default: m.PublicPortalScreen })),

)

const RoleSelectionScreen = lazy(() =>

  import('@/screens/role-selection-screen').then((m) => ({ default: m.RoleSelectionScreen })),

)

const AuthScreen = lazy(() => import('@/screens/auth-screen').then((m) => ({ default: m.AuthScreen })))

const AboutFaroScreen = lazy(() =>

  import('@/screens/about-faro-screen').then((m) => ({ default: m.AboutFaroScreen })),

)



function PortalLoading() {

  return (

    <div className="flex min-h-screen items-center justify-center bg-[#0B1626] text-sm text-[#7690AC]">

      Cargando FARO…

    </div>

  )

}



function RoleSelectionRoute() {

  return (

    <Suspense fallback={<PortalLoading />}>

      <RoleSelectionScreen />

    </Suspense>

  )

}



/**

 * Contenido principal — solo accesible si RoleGuard permite pasar.

 */

function FaroAppRoutes() {

  const {

    canAccessCoordinatorPanel,

    canAccessAdminPanel,

    canAccessSystemPanel,

    needsRoleSelection,

    isNetworkMember,

  } = usePermissions()

  const { session, user, pendingAuthIntent, clearPendingAuthIntent } = useAuth()

  const { showInitialOnboarding, completeInitialOnboarding } = useOnboardingGate()

  const [helpOpen, setHelpOpen] = useState(false)

  const [authOpen, setAuthOpen] = useState(false)

  const [aboutOpen, setAboutOpen] = useState(false)



  const isAuthenticated = Boolean(session ?? user)

  const showNetworkApp =

    isAuthenticated &&

    !needsRoleSelection &&

    (isNetworkMember || canAccessCoordinatorPanel || canAccessAdminPanel || canAccessSystemPanel)



  useEffect(() => {

    const openHelp = () => setHelpOpen(true)

    window.addEventListener('faro:open-help-center', openHelp)

    return () => window.removeEventListener('faro:open-help-center', openHelp)

  }, [])



  useEffect(() => {

    if (isAuthenticated && pendingAuthIntent === 'email_confirmation') {

      setAuthOpen(false)

    }

  }, [isAuthenticated, pendingAuthIntent])



  useEffect(() => {

    if (pendingAuthIntent === 'password_recovery') {

      setAuthOpen(true)

    }

  }, [pendingAuthIntent])



  const openJoinNetwork = useCallback(() => setAuthOpen(true), [])



  if (showNetworkApp) {

    return (

      <>

        <AppShell />

        <PwaUpdateBanner />

        <PushDebugPanel />

        <PwaDiagnosticsPanel />

        <InitialOnboardingFlow open={showInitialOnboarding} onComplete={completeInitialOnboarding} />

        <HelpCenterSheet open={helpOpen} onClose={() => setHelpOpen(false)} />

        {authOpen && pendingAuthIntent === 'password_recovery' && (

          <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0B1626]">

            <Suspense fallback={<PortalLoading />}>

              <AuthScreen

                initialMode="reset-password"

                onClose={() => {

                  setAuthOpen(false)

                  clearPendingAuthIntent()

                }}

              />

            </Suspense>

          </div>

        )}

      </>

    )

  }



  return (

    <>

      <Suspense fallback={<PortalLoading />}>

        <PublicPortalScreen

          onJoinNetwork={openJoinNetwork}

          onOpenHelp={() => setHelpOpen(true)}

          onOpenAbout={() => setAboutOpen(true)}

        />

      </Suspense>

      <PwaUpdateBanner />

      {authOpen && (

        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0B1626]">

          <Suspense fallback={<PortalLoading />}>

            <AuthScreen

              initialMode={pendingAuthIntent === 'password_recovery' ? 'reset-password' : 'login'}

              onClose={() => {

                setAuthOpen(false)

                if (pendingAuthIntent === 'password_recovery') clearPendingAuthIntent()

              }}

            />

          </Suspense>

        </div>

      )}

      {aboutOpen && (

        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0B1626]">

          <Suspense fallback={<PortalLoading />}>

            <AboutFaroScreen onBack={() => setAboutOpen(false)} />

          </Suspense>

        </div>

      )}

      <HelpCenterSheet open={helpOpen} onClose={() => setHelpOpen(false)} />

    </>

  )

}



export default function App() {

  return (

    <RoleGuard fallback={<PortalLoading />} roleSelection={<RoleSelectionRoute />}>

      <FaroAppRoutes />

    </RoleGuard>

  )

}


