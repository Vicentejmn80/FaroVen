import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { completeAuthFromUrl, type AuthCallbackIntent, type SignUpResult } from '@/lib/auth-callback'
import { formatAuthError } from '@/lib/auth-errors'
import { resolveAuthSession } from '@/lib/auth-session'
import {
  canAccessAdminPanel,
  canAccessCoordinatorPanel,
  canAccessSystemPanel,
  FARO_ROLES,
  hasPendingNetworkRoleRequest,
  isNetworkMemberRole,
  needsNetworkRoleSelection,
  type FaroRole,
  type RequestableNetworkRole,
} from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/repositories/auth-types'
import { authService, resolvePublicRole } from '@/services/auth-service'
import { legalService } from '@/services/legal-service'

/** Evita quedarse en "Cargando FARO" si red/auth cuelgan. */
const AUTH_BOOT_TIMEOUT_MS = 8_000

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  role: FaroRole
  /** true hasta que sesión + perfil (si hay sesión) estén resueltos */
  loading: boolean
  /** true mientras se carga/recarga el perfil con sesión activa */
  profileReady: boolean
  authError: string | null
  pendingAuthIntent: AuthCallbackIntent
  clearAuthError: () => void
  clearPendingAuthIntent: () => void
  refreshProfile: () => Promise<void>
  selectVolunteerRole: () => Promise<void>
  requestNetworkRole: (role: RequestableNetworkRole, reason: string) => Promise<void>
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, phone: string, captchaToken?: string) => Promise<SignUpResult>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
  resendSignupConfirmation: (email: string, captchaToken?: string) => Promise<void>
  resetPassword: (email: string, captchaToken?: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  needsRoleSelection: boolean
  hasPendingRoleRequest: boolean
  isNetworkMember: boolean
  canAccessCoordinatorPanel: boolean
  canAccessAdminPanel: boolean
  canAccessSystemPanel: boolean
  /** Laboratorio FARO — rol simulado (solo frontend, no toca DB) */
  simulatedRole: FaroRole | null
  setSimulatedRole: (role: FaroRole | null) => void
  isSimulating: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(fallback)
      }
    }, ms)

    promise
      .then((value) => {
        if (!settled) {
          settled = true
          window.clearTimeout(timer)
          resolve(value)
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true
          window.clearTimeout(timer)
          resolve(fallback)
        }
      })
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pendingAuthIntent, setPendingAuthIntent] = useState<AuthCallbackIntent>('none')
  const [simulatedRole, setSimulatedRoleState] = useState<FaroRole | null>(null)
  const bootCompletedRef = useRef(false)

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null)
      setProfileReady(true)
      return
    }
    setProfileReady(false)
    try {
      const next = await withTimeout(authService.loadProfile(user), AUTH_BOOT_TIMEOUT_MS, null)
      setProfile(next)
    } catch {
      // Perfil no bloqueante: la UI puede continuar sin él
      setProfile(null)
    } finally {
      setProfileReady(true)
    }
  }, [])

  const syncLegalConsentSafe = useCallback(async (userId?: string | null) => {
    if (!userId || !legalService.isBackendEnabled()) return
    try {
      await withTimeout(legalService.syncPendingConsent(userId), 4_000, null)
    } catch {
      // RLS / red — no bloquear auth
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const releaseLoading = () => {
      if (mounted) {
        bootCompletedRef.current = true
        setLoading(false)
      }
    }

    // Safety net: pase lo que pase, liberar el gate de carga
    const bootTimeout = window.setTimeout(releaseLoading, AUTH_BOOT_TIMEOUT_MS)

    async function initAuth() {
      try {
        const callbackResult = await completeAuthFromUrl()
        if (!mounted) return
        if (callbackResult.error) setAuthError(callbackResult.error)
        if (callbackResult.intent !== 'none') setPendingAuthIntent(callbackResult.intent)

        const resolved = await withTimeout(
          resolveAuthSession(),
          AUTH_BOOT_TIMEOUT_MS,
          { session: null, user: null, clockSkewWarning: null },
        )
        if (!mounted) return

        setSession(resolved.session)
        const authUser = resolved.session?.user ?? resolved.user
        setVerifiedUser(authUser)
        await loadProfile(authUser)
        if (resolved.clockSkewWarning && !callbackResult.error) {
          setAuthError(resolved.clockSkewWarning)
        }
        await syncLegalConsentSafe(authUser?.id)
      } catch {
        // Boot no debe fallar la app
      } finally {
        window.clearTimeout(bootTimeout)
        releaseLoading()
      }
    }

    void initAuth()

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void (async () => {
        if (!mounted) return

        // Refresh / update de token al volver de pestaña: no re-bloquear la UI
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (nextSession) {
            setSession(nextSession)
            setVerifiedUser(nextSession.user)
            // Perfil en background; no tocar loading
            void loadProfile(nextSession.user)
          }
          return
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'INITIAL_SESSION'
        ) {
          setSession(nextSession)
          if (nextSession) {
            setVerifiedUser(nextSession.user)
            // Solo mostrar splash si el boot inicial aún no terminó
            if (!bootCompletedRef.current) {
              setLoading(true)
            }
            try {
              await loadProfile(nextSession.user)
              await syncLegalConsentSafe(nextSession.user.id)
              setAuthError(null)
            } catch {
              // no-op
            } finally {
              releaseLoading()
            }
          } else {
            try {
              const resolved = await withTimeout(
                resolveAuthSession(),
                AUTH_BOOT_TIMEOUT_MS,
                { session: null, user: null, clockSkewWarning: null },
              )
              if (!mounted) return
              setSession(resolved.session)
              const authUser = resolved.session?.user ?? resolved.user
              setVerifiedUser(authUser)
              if (authUser) {
                if (!bootCompletedRef.current) setLoading(true)
                await loadProfile(authUser)
                await syncLegalConsentSafe(authUser.id)
              } else {
                setProfile(null)
                setProfileReady(true)
              }
            } catch {
              setProfile(null)
              setProfileReady(true)
            } finally {
              releaseLoading()
            }
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setVerifiedUser(null)
          setProfile(null)
          setProfileReady(true)
          setPendingAuthIntent('none')
          setSimulatedRoleState(null)
          releaseLoading()
        }
      })()
    })

    return () => {
      mounted = false
      window.clearTimeout(bootTimeout)
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile, syncLegalConsentSafe])

  // Sincronizar rol cuando un admin aprueba (profiles en vivo).
  useEffect(() => {
    const userId = session?.user?.id ?? verifiedUser?.id
    if (!userId) return

    const activeUser = session?.user ?? verifiedUser
    if (!activeUser) return

    const channel = supabase
      .channel(`profile-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => {
          void loadProfile(activeUser)
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
          void loadProfile(activeUser)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user?.id, verifiedUser?.id, loadProfile])

  const activeUser = session?.user ?? verifiedUser
  const realRole = resolvePublicRole(profile)
  const isAuthenticated = Boolean(session ?? verifiedUser)

  // Laboratorio FARO: cuando simulatedRole está activo, se usa en lugar del rol real
  const role = simulatedRole ?? realRole
  const isSimulating = simulatedRole !== null

  // Cuando se simula, forzamos needsRoleSelection a false para evitar redirects
  const needsRoleSelection = isSimulating
    ? false
    : Boolean(isAuthenticated && profileReady && needsNetworkRoleSelection(profile))
  const hasPendingRoleRequest = hasPendingNetworkRoleRequest(profile)
  const isNetworkMember = isNetworkMemberRole(role)

  const setSimulatedRole = useCallback((r: FaroRole | null) => {
    setSimulatedRoleState(r)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: activeUser,
      profile,
      role,
      loading,
      profileReady,
      authError,
      pendingAuthIntent,
      clearAuthError: () => setAuthError(null),
      clearPendingAuthIntent: () => setPendingAuthIntent('none'),
      refreshProfile: async () => loadProfile(activeUser),
      selectVolunteerRole: async () => {
        const next = await authService.selectVolunteerRole()
        setProfile(next)
        setProfileReady(true)
      },
      requestNetworkRole: async (requestedRole, reason) => {
        const next = await authService.requestNetworkRole(requestedRole, reason)
        setProfile(next)
        setProfileReady(true)
      },
      signInWithPassword: async (email, password, captchaToken) => {
        setLoading(true)
        try {
          const { session: nextSession } = await authService.signInWithPassword(email, password, captchaToken)
          setSession(nextSession)
          setVerifiedUser(nextSession?.user ?? null)
          await loadProfile(nextSession?.user ?? null)
          await syncLegalConsentSafe(nextSession?.user?.id)
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : formatAuthError(String(err)))
          throw err
        } finally {
          setLoading(false)
        }
      },
      signUp: (email, password, fullName, phone, captchaToken) =>
        authService.signUp(email, password, fullName, phone, captchaToken),
      verifyEmailOtp: async (email, token) => {
        setLoading(true)
        try {
          const { session: nextSession } = await authService.verifyEmailOtp(email, token)
          setSession(nextSession)
          setVerifiedUser(nextSession?.user ?? null)
          await loadProfile(nextSession?.user ?? null)
          await syncLegalConsentSafe(nextSession?.user?.id)
          setPendingAuthIntent('email_confirmation')
        } finally {
          setLoading(false)
        }
      },
      resendSignupConfirmation: (email, captchaToken) =>
        authService.resendSignupConfirmation(email, captchaToken),
      resetPassword: async (email, captchaToken) => authService.resetPassword(email, captchaToken),
      updatePassword: async (password) => {
        await authService.updatePassword(password)
        await authService.signOut()
        setSession(null)
        setVerifiedUser(null)
        setProfile(null)
        setProfileReady(true)
        setPendingAuthIntent('none')
      },
      signOut: async () => {
        await authService.signOut()
        setSession(null)
        setVerifiedUser(null)
        setProfile(null)
        setProfileReady(true)
        setPendingAuthIntent('none')
        setSimulatedRoleState(null)
      },
      needsRoleSelection,
      hasPendingRoleRequest,
      isNetworkMember,
      canAccessCoordinatorPanel: canAccessCoordinatorPanel(role),
      canAccessAdminPanel: canAccessAdminPanel(role),
      canAccessSystemPanel: canAccessSystemPanel(role, activeUser?.email),
      simulatedRole,
      setSimulatedRole,
      isSimulating,
    }),
    [
      session,
      profile,
      role,
      loading,
      profileReady,
      authError,
      pendingAuthIntent,
      loadProfile,
      syncLegalConsentSafe,
      activeUser,
      needsRoleSelection,
      hasPendingRoleRequest,
      isNetworkMember,
      simulatedRole,
      setSimulatedRole,
      isSimulating,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function usePermissions() {
  const {
    role,
    canAccessCoordinatorPanel,
    canAccessAdminPanel,
    canAccessSystemPanel,
    user,
    needsRoleSelection,
    hasPendingRoleRequest,
    isNetworkMember,
    profileReady,
    loading,
  } = useAuth()
  return {
    role,
    isAuthenticated: Boolean(user),
    isPublic: role === FARO_ROLES.PUBLIC,
    isVolunteer: role === FARO_ROLES.VOLUNTEER,
    isCaseManager: role === FARO_ROLES.CASE_MANAGER,
    isCoordinator: role === FARO_ROLES.COORDINATOR,
    isRegionalAdmin: role === FARO_ROLES.REGIONAL_ADMIN,
    isSuperAdmin: canAccessSystemPanel,
    needsRoleSelection,
    hasPendingRoleRequest,
    isNetworkMember,
    profileReady,
    loading,
    canAccessCoordinatorPanel,
    canAccessAdminPanel,
    canAccessSystemPanel,
  }
}
