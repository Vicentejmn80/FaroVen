import { supabase } from '@/lib/supabase'

function cleanAuthParams(url: URL, keys: string[]) {
  keys.forEach((key) => url.searchParams.delete(key))
  const cleaned = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', cleaned)
}

function mapVerifyType(type: string): 'email' | 'signup' | 'magiclink' | 'recovery' | 'invite' {
  switch (type) {
    case 'signup':
      return 'signup'
    case 'magiclink':
      return 'magiclink'
    case 'recovery':
      return 'recovery'
    case 'invite':
      return 'invite'
    default:
      return 'email'
  }
}

/**
 * Handles token_hash links (email confirm / some magic links).
 * PKCE `code` and implicit `#access_token` are handled by supabase.auth.initialize().
 */
async function verifyTokenHashFromUrl(): Promise<{ error: string | null }> {
  const url = new URL(window.location.href)
  const tokenHash = url.searchParams.get('token_hash') ?? url.searchParams.get('token')
  const type = url.searchParams.get('type')

  if (!tokenHash || !type) {
    return { error: null }
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: mapVerifyType(type),
  })

  if (error) {
    return { error: error.message }
  }

  cleanAuthParams(url, ['token_hash', 'token', 'type'])
  return { error: null }
}

/**
 * Completes Supabase auth callback from the current URL.
 * Call before route guards decide the user is logged out.
 */
export async function completeAuthFromUrl(): Promise<{ error: string | null }> {
  const url = new URL(window.location.href)
  const errorDescription = url.searchParams.get('error_description')

  if (errorDescription) {
    return { error: decodeURIComponent(errorDescription) }
  }

  const tokenHashResult = await verifyTokenHashFromUrl()
  if (tokenHashResult.error) {
    return tokenHashResult
  }

  const { error: initError } = await supabase.auth.initialize()
  if (initError) {
    return { error: initError.message }
  }

  if (url.searchParams.has('code')) {
    cleanAuthParams(url, ['code', 'error', 'error_description'])
  }

  if (url.hash.includes('access_token=')) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }

  return { error: null }
}

export function hasAuthCallbackInUrl(): boolean {
  const url = new URL(window.location.href)
  return (
    url.searchParams.has('code') ||
    url.searchParams.has('token_hash') ||
    url.searchParams.has('token') ||
    url.hash.includes('access_token=') ||
    url.hash.includes('type=magiclink') ||
    (url.searchParams.has('type') &&
      (url.searchParams.has('token_hash') || url.searchParams.has('token')))
  )
}

/** @deprecated use hasAuthCallbackInUrl */
export function hasPendingAuthCallback(): boolean {
  return hasAuthCallbackInUrl()
}

export function buildAuthRedirectUrl(redirectPath: string): string {
  const redirect = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`
  return `${window.location.origin}/auth?redirect=${encodeURIComponent(redirect)}`
}

/** @deprecated use buildAuthRedirectUrl */
export function buildAuthCallbackUrl(redirectPath: string): string {
  return buildAuthRedirectUrl(redirectPath)
}
