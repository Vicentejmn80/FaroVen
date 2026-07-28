import { isClockSkewError } from '@/lib/auth-session'
import { FARO_ROUTES } from '@/lib/faro-routes'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export type SignUpResult = {
  user: User | null
  session: Session | null
  needsEmailConfirmation: boolean
}

export type AuthCallbackIntent = 'none' | 'password_recovery' | 'email_confirmation'

function readHashType(): string | null {
  if (typeof window === 'undefined' || !window.location.hash) return null
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
}

async function recoverSessionAfterClockSkew(): Promise<string | null> {
  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError && !isClockSkewError(refreshError.message)) {
    return refreshError.message
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userData.user) return null

  return userError?.message ?? refreshError?.message ?? null
}

export async function completeAuthFromUrl(): Promise<{
  error: string | null
  intent: AuthCallbackIntent
}> {
  if (typeof window === 'undefined') return { error: null, intent: 'none' }

  const params = new URLSearchParams(window.location.search)
  const errorDescription = params.get('error_description')
  if (errorDescription) return { error: errorDescription, intent: 'none' }

  const hashType = readHashType()
  const hasAuthFragment = window.location.hash.includes('access_token')
  const hasAuthCode = window.location.search.includes('code=')

  if (!hasAuthFragment && !hasAuthCode) {
    return { error: null, intent: 'none' }
  }

  let errorMessage: string | null = null
  const isRecoveryIntent =
    hashType === 'recovery' || params.get('auth') === 'recovery' || params.get('type') === 'recovery'
  const isEmailConfirmationIntent =
    !isRecoveryIntent &&
    (hashType === 'signup' ||
      hashType === 'email' ||
      hashType === 'magiclink' ||
      hasAuthFragment ||
      hasAuthCode)

  if (hasAuthCode) {
    const code = params.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        errorMessage = error.message
        if (isClockSkewError(error.message)) {
          const recovered = await recoverSessionAfterClockSkew()
          if (recovered) errorMessage = recovered
          else errorMessage = null
        }
      }
    }
  } else {
    const { error } = await supabase.auth.getSession()
    if (error) {
      errorMessage = error.message
      if (isClockSkewError(error.message)) {
        const recovered = await recoverSessionAfterClockSkew()
        if (recovered) errorMessage = recovered
        else errorMessage = null
      }
    }
  }

  // Limpiar tokens de Supabase; email confirm → /role-selection
  const cleanPath = isRecoveryIntent
    ? `${FARO_ROUTES.home}?auth=recovery`
    : isEmailConfirmationIntent
      ? FARO_ROUTES.roleSelection
      : window.location.pathname

  window.history.replaceState({}, document.title, cleanPath)

  if (isRecoveryIntent) {
    return { error: errorMessage, intent: 'password_recovery' }
  }

  if (isEmailConfirmationIntent) {
    return { error: errorMessage, intent: 'email_confirmation' }
  }

  return { error: errorMessage, intent: 'none' }
}
