import { useEffect, type ReactNode } from 'react'
import { isRoleSelectionPath, syncRoleSelectionUrl } from '@/lib/faro-routes'
import { useAuth } from '@/store/auth-context'

interface RoleGuardProps {
  children: ReactNode
  roleSelection: ReactNode
  fallback?: ReactNode
}

/**
 * Guard de nivel más alto: prioridad absoluta sobre cualquier redirección de Supabase.
 * Usuario autenticado sin rol de red → solo /role-selection.
 */
export function RoleGuard({ children, roleSelection, fallback = null }: RoleGuardProps) {
  const { session, user, loading, profileReady, needsRoleSelection, pendingAuthIntent } = useAuth()

  const isAuthenticated = Boolean(session ?? user)
  const guardPending = loading || (isAuthenticated && !profileReady)
  const mustSelectRole =
    isAuthenticated && needsRoleSelection && pendingAuthIntent !== 'password_recovery'

  // Forzar URL canónica — ignora destino post-confirmación de Supabase
  useEffect(() => {
    if (guardPending) return
    syncRoleSelectionUrl(mustSelectRole)
  }, [guardPending, mustSelectRole])

  // Evitar salir de /role-selection con botón atrás mientras falte rol
  useEffect(() => {
    if (!mustSelectRole) return

    const handlePopState = () => {
      if (!isRoleSelectionPath()) {
        syncRoleSelectionUrl(true)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [mustSelectRole])

  // Visitante en /role-selection → volver a home
  useEffect(() => {
    if (guardPending || isAuthenticated) return
    if (isRoleSelectionPath()) {
      syncRoleSelectionUrl(false)
    }
  }, [guardPending, isAuthenticated])

  if (guardPending) {
    return <>{fallback}</>
  }

  if (mustSelectRole) {
    return <>{roleSelection}</>
  }

  return <>{children}</>
}
