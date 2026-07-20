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
 * Fuerza /role-selection cuando falta rol de red.
 * Ignora la URL de retorno de Supabase (/, ?code=, hash tokens).
 */
export function syncRoleSelectionUrl(mustBeOnRoleSelection: boolean): void {
  if (typeof window === 'undefined') return

  const { pathname, search, hash } = window.location

  if (mustBeOnRoleSelection) {
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
