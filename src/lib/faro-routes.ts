/** Rutas canónicas FARO (History API — sin react-router). */
export const FARO_ROUTES = {
  home: '/',
  roleSelection: '/role-selection',
} as const

export function isRoleSelectionPath(pathname = window.location.pathname): boolean {
  return pathname === FARO_ROUTES.roleSelection || pathname.startsWith(`${FARO_ROUTES.roleSelection}/`)
}

export function isHomePath(pathname = window.location.pathname): boolean {
  return pathname === FARO_ROUTES.home
}

/**
 * URL absoluta para confirmación de correo / magic link.
 * Apunta a /role-selection (sin query) para que coincida con la allowlist
 * de Redirect URLs en Supabase y caiga en la elección de roles (PWA o web).
 */
export function buildAuthEmailRedirectUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return new URL(FARO_ROUTES.roleSelection, origin || 'https://localhost').toString()
}

/**
 * Fuerza /role-selection cuando falta rol de red.
 * Ignora la URL de retorno de Supabase (/, ?code=, hash tokens).
 */
export function syncRoleSelectionUrl(mustBeOnRoleSelection: boolean): void {
  if (typeof window === 'undefined') return

  const { pathname, search, hash } = window.location

  if (mustBeOnRoleSelection) {
    // Conservar solo la ruta canónica (sin query/hash de Supabase)
    if (pathname !== FARO_ROUTES.roleSelection || search || hash) {
      window.history.replaceState(window.history.state, '', FARO_ROUTES.roleSelection)
    }
    return
  }

  if (isRoleSelectionPath(pathname)) {
    window.history.replaceState(window.history.state, '', FARO_ROUTES.home)
  }
}

export function hasSupabaseAuthCallback(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.location.search.includes('code=') ||
    window.location.hash.includes('access_token') ||
    Boolean(new URLSearchParams(window.location.search).get('error_description'))
  )
}
