import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { completeAuthFromUrl, type AuthCallbackIntent, type SignUpResult } from '@/lib/auth-callback'
import {
  canAccessAdminPanel,
  canAccessCoordinatorPanel,
  canAccessSystemPanel,
  FARO_ROLES,
  type FaroRole,
} from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/repositories/auth-types'
import { authService, resolvePublicRole } from '@/services/auth-service'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  role: FaroRole
  loading: boolean
  authError: string | null
  pendingAuthIntent: AuthCallbackIntent
  clearAuthError: () => void
  clearPendingAuthIntent: () => void
  refreshProfile: () => Promise<void>
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, phone: string, captchaToken?: string) => Promise<SignUpResult>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
  resendSignupConfirmation: (email: string, captchaToken?: string) => Promise<void>
  resetPassword: (email: string, captchaToken?: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  canAccessCoordinatorPanel: boolean
  canAccessAdminPanel: boolean
  canAccessSystemPanel: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pendingAuthIntent, setPendingAuthIntent] = useState<AuthCallbackIntent>('none')

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null)
      return
    }
    const next = await authService.loadProfile(user)
    setProfile(next)
  }, [])

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      const callbackResult = await completeAuthFromUrl()
      if (!mounted) return
      if (callbackResult.error) setAuthError(callbackResult.error)
      if (callbackResult.intent !== 'none') setPendingAuthIntent(callbackResult.intent)

      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setSession(data.session)
      await loadProfile(data.session?.user ?? null)
      if (mounted) setLoading(false)
    }

    void initAuth()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfile(nextSession?.user ?? null)
      setLoading(false)
      if (nextSession) setAuthError(null)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Sincronizar rol cuando un admin aprueba al coordinador (profiles en vivo).
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const channel = supabase
      .channel(`profile-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => {
          void loadProfile(session.user)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coordinator_profiles',
          filter: `auth_user_id=eq.${userId}`,
        },
        () => {
          void loadProfile(session.user)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user, loadProfile])

  const role = resolvePublicRole(profile)

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      loading,
      authError,
      pendingAuthIntent,
      clearAuthError: () => setAuthError(null),
      clearPendingAuthIntent: () => setPendingAuthIntent('none'),
      refreshProfile: async () => loadProfile(session?.user ?? null),
      signInWithPassword: async (email, password, captchaToken) => {
        const { session: nextSession } = await authService.signInWithPassword(email, password, captchaToken)
        setSession(nextSession)
        await loadProfile(nextSession?.user ?? null)
      },
      signUp: (email, password, fullName, phone, captchaToken) =>
        authService.signUp(email, password, fullName, phone, captchaToken),
      verifyEmailOtp: async (email, token) => {
        const { session: nextSession } = await authService.verifyEmailOtp(email, token)
        setSession(nextSession)
        await loadProfile(nextSession?.user ?? null)
      },
      resendSignupConfirmation: (email, captchaToken) =>
        authService.resendSignupConfirmation(email, captchaToken),
      resetPassword: async (email, captchaToken) => authService.resetPassword(email, captchaToken),
      updatePassword: async (password) => {
        await authService.updatePassword(password)
        await authService.signOut()
        setSession(null)
        setProfile(null)
        setPendingAuthIntent('none')
      },
      signOut: async () => {
        await authService.signOut()
        setSession(null)
        setProfile(null)
      },
      canAccessCoordinatorPanel: canAccessCoordinatorPanel(role),
      canAccessAdminPanel: canAccessAdminPanel(role),
      canAccessSystemPanel: canAccessSystemPanel(role, session?.user?.email),
    }),
    [session, profile, role, loading, authError, pendingAuthIntent, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function usePermissions() {
  const { role, canAccessCoordinatorPanel, canAccessAdminPanel, canAccessSystemPanel, user } = useAuth()
  return {
    role,
    isAuthenticated: Boolean(user),
    isPublic: role === FARO_ROLES.PUBLIC,
    isCoordinator: role === FARO_ROLES.COORDINATOR,
    isRegionalAdmin: role === FARO_ROLES.REGIONAL_ADMIN,
    isSuperAdmin: canAccessSystemPanel,
    canAccessCoordinatorPanel,
    canAccessAdminPanel,
    canAccessSystemPanel,
  }
}
