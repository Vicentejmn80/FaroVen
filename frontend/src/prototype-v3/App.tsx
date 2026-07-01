import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/auth-provider'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useIsAdmin } from '@/hooks/useAdmin'
import { clearV3ViewParam, readV3ViewFromUrl } from './lib/auth-redirect'
import { AuthView } from './components/AuthView'
import { AdminPanel } from './components/AdminPanel'
import { CoordinatorOnboardingView } from './components/coordinator/CoordinatorOnboardingView'
import { TriageDashboard } from './components/coordinator/TriageDashboard'

type ViewId = 'triage' | 'onboarding' | 'auth' | 'admin' | 'edit-profile'

export function PrototypeV3App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { data: profile, isLoading: profileLoading } = useCoordinatorProfile()
  const { data: isAdmin } = useIsAdmin()

  const [view, setView] = useState<ViewId>('auth')
  const [authTarget, setAuthTarget] = useState<'coordinator' | 'admin'>('coordinator')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isReady = !!profile && profile.onboarding_complete !== false

  const notify = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  // Magic link / OAuth redirect: ?view=coordinator|admin
  useEffect(() => {
    if (authLoading) return
    const urlView = readV3ViewFromUrl()
    if (urlView) {
      clearV3ViewParam()
      if (!user) {
        setAuthTarget(urlView)
        setView('auth')
        return
      }
      setView(urlView === 'admin' && isAdmin ? 'admin' : isReady ? 'triage' : 'onboarding')
      return
    }
  }, [authLoading, user, isAdmin, isReady])

  // Auto-route según sesión
  useEffect(() => {
    if (authLoading || profileLoading) return
    if (view === 'admin' || view === 'edit-profile') return

    const urlView = readV3ViewFromUrl()
    if (urlView) return

    if (!user) {
      setView('auth')
      return
    }
    if (isReady) {
      setView('triage')
    } else {
      setView('onboarding')
    }
  }, [authLoading, profileLoading, user, isReady, view])

  const openAdmin = () => {
    if (user && isAdmin) setView('admin')
    else {
      setAuthTarget('admin')
      setView('auth')
    }
  }

  if (authLoading || (user && profileLoading && view !== 'auth')) {
    return (
      <div className="pv3 pv3--operational">
        <p className="pv3-loading">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="pv3 pv3--operational">
      {view === 'auth' && (
        <AuthView
          targetView={authTarget}
          onSuccess={() => setView(authTarget === 'admin' && isAdmin ? 'admin' : 'onboarding')}
          onBack={() => setView(user ? (isReady ? 'triage' : 'onboarding') : 'auth')}
        />
      )}

      {(view === 'onboarding' || view === 'edit-profile') && user && (
        <div className="pv3-onboarding">
          <div className="triage-header">
            <div className="triage-header__left">
              <span className="triage-site-name">
                {view === 'edit-profile' ? 'Actualizar registro' : 'Registro de coordinador'}
              </span>
            </div>
            <div className="triage-header__right">
              {view === 'edit-profile' && isReady && (
                <button type="button" className="triage-header__signout" onClick={() => setView('triage')}>
                  Cancelar
                </button>
              )}
              <button type="button" className="triage-header__signout" onClick={() => signOut()}>
                Salir
              </button>
            </div>
          </div>
          <CoordinatorOnboardingView
            notify={notify}
            onDone={() => {
              notify('Registro completado.')
              setView('triage')
            }}
          />
        </div>
      )}

      {view === 'triage' && user && isReady && (
        <TriageDashboard
          notify={notify}
          onEditProfile={() => setView('edit-profile')}
          onOpenAdmin={openAdmin}
          onSignOut={() => signOut()}
          isAdmin={!!isAdmin}
        />
      )}

      {view === 'admin' && (
        <AdminPanel
          onBack={() => setView('triage')}
          onNeedAuth={() => {
            setAuthTarget('admin')
            setView('auth')
          }}
        />
      )}

      {toast && <div className="pv3-toast">{toast}</div>}
    </div>
  )
}
