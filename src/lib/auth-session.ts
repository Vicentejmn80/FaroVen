import type { Session, User } from '@supabase/supabase-js'
import { hasSupabaseAuthCallback } from '@/lib/faro-routes'
import { supabase } from '@/lib/supabase'

export function isClockSkewError(message: string | undefined | null): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('clock') ||
    normalized.includes('skew') ||
    normalized.includes('issued in the future') ||
    normalized.includes('exp claim') ||
    normalized.includes('nbf claim') ||
    normalized.includes('jwt expired') ||
    normalized.includes('invalid jwt') ||
    normalized.includes('token is expired')
  )
}

export type ResolvedAuth = {
  session: Session | null
  user: User | null
  clockSkewWarning: string | null
}

/**
 * Resuelve sesión de forma tolerante a clock skew.
 * getUser() valida en servidor; refreshSession() renueva tokens locales inválidos.
 */
export async function resolveAuthSession(): Promise<ResolvedAuth> {
  let clockSkewWarning: string | null = null

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError && isClockSkewError(sessionError.message)) {
    clockSkewWarning = sessionError.message
  }

  if (sessionData.session?.user) {
    return {
      session: sessionData.session,
      user: sessionData.session.user,
      clockSkewWarning,
    }
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError && isClockSkewError(refreshError.message)) {
    clockSkewWarning = clockSkewWarning ?? refreshError.message
  }
  if (refreshData.session?.user) {
    return {
      session: refreshData.session,
      user: refreshData.session.user,
      clockSkewWarning,
    }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError && isClockSkewError(userError.message)) {
    clockSkewWarning = clockSkewWarning ?? userError.message
  }
  if (userData.user) {
    const { data: retryRefresh } = await supabase.auth.refreshSession()
    if (retryRefresh.session?.user) {
      return {
        session: retryRefresh.session,
        user: retryRefresh.session.user,
        clockSkewWarning,
      }
    }
    return {
      session: null,
      user: userData.user,
      clockSkewWarning,
    }
  }

  const staleSessionMessage = userError?.message?.toLowerCase() ?? ''
  if (
    staleSessionMessage.includes('user from sub claim') ||
    staleSessionMessage.includes('user_not_found') ||
    staleSessionMessage.includes('refresh_token_not_found')
  ) {
    await supabase.auth.signOut({ scope: 'local' })
  }

  if (hasSupabaseAuthCallback() || clockSkewWarning) {
    await delay(400)
    const { data: lateSession } = await supabase.auth.getSession()
    if (lateSession.session?.user) {
      return {
        session: lateSession.session,
        user: lateSession.session.user,
        clockSkewWarning,
      }
    }
  }

  return {
    session: null,
    user: null,
    clockSkewWarning: clockSkewWarning ?? userError?.message ?? sessionError?.message ?? null,
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
