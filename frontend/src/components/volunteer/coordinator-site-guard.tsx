import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export function CoordinatorSiteGuard() {
  const location = useLocation()
  const { data: profile, isLoading } = useCoordinatorProfile()
  const onSetupPage = location.pathname === '/volunteer/sitio'

  if (isLoading) {
    return (
      <div className="py-16">
        <LoadingSpinner />
        <p className="text-center text-sm text-muted-foreground mt-4">Cargando tu sitio...</p>
      </div>
    )
  }

  if (!profile && !onSetupPage) {
    return <Navigate to="/volunteer/sitio" replace />
  }

  if (profile && onSetupPage && !location.search.includes('edit=1')) {
    return <Navigate to="/volunteer" replace />
  }

  return <Outlet />
}
