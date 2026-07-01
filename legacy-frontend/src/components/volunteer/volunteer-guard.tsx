import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { useAuth } from '@/context/auth-provider'
import { hasPendingAuthCallback } from '@/lib/auth-callback'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export function VolunteerGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  const pendingCallback = hasPendingAuthCallback()
  const [resolvedSession, setResolvedSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (session) {
      setResolvedSession(session)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setResolvedSession(data.session)
    })

    return () => {
      mounted = false
    }
  }, [session])

  if (loading || pendingCallback || resolvedSession === undefined) {
    return (
      <div className="py-16">
        <LoadingSpinner />
        <p className="text-center text-sm text-muted-foreground mt-4">
          Completando acceso...
        </p>
      </div>
    )
  }

  if (!resolvedSession) {
    const redirect = encodeURIComponent(location.pathname)
    return <Navigate to={`/auth?redirect=${redirect}`} replace />
  }

  return <>{children}</>
}
