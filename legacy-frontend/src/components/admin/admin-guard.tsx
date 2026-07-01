import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/auth-provider'
import { useIsAdmin } from '@/hooks/useAdmin'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  const { data: isAdmin, isLoading: checkingRole } = useIsAdmin()

  if (loading || checkingRole) {
    return (
      <div className="py-16">
        <LoadingSpinner />
        <p className="text-center text-sm text-muted-foreground mt-4">Verificando acceso...</p>
      </div>
    )
  }

  if (!session) {
    const redirect = encodeURIComponent(location.pathname)
    return <Navigate to={`/auth?redirect=${redirect}`} replace />
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <p className="text-2xl mb-3">🔒</p>
        <h2 className="font-semibold text-lg mb-2">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground">
          Esta sección es solo para administradores. Si crees que deberías tener acceso, contacta al
          equipo de FARO.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
