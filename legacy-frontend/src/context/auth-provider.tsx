import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { completeAuthFromUrl } from '@/lib/auth-callback'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  authError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      const callbackResult = await completeAuthFromUrl()
      if (!mounted) return

      if (callbackResult.error) {
        setAuthError(callbackResult.error)
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setSession(data.session)
      setLoading(false)
    }

    initAuth()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (nextSession) setAuthError(null)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      authError,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, authError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
