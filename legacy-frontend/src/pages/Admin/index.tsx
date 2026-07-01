import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdminReports } from '@/hooks/useAdmin'
import { useAdminSupportRequests } from '@/hooks/useAdmin'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export function AdminHomePage() {
  const { data: reports, isLoading: loadingReports } = useAdminReports('pending')
  const { data: support, isLoading: loadingSupport } = useAdminSupportRequests('pending')

  const pendingReports = reports?.length ?? 0
  const pendingSupport = support?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-1">Panel de administración</h1>
        <p className="text-sm text-muted-foreground">
          Revisa y modera los reportes ciudadanos y las solicitudes de apoyo emocional.
        </p>
      </div>

      {(loadingReports || loadingSupport) && <LoadingSpinner />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/admin/reportes">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">Reportes ciudadanos</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : (
                <>
                  <p className="text-3xl font-bold">{pendingReports}</p>
                  <p className="text-sm text-muted-foreground mt-1">pendiente{pendingReports !== 1 ? 's' : ''} de revisión</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/apoyo">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">Solicitudes de apoyo emocional</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSupport ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : (
                <>
                  <p className="text-3xl font-bold">{pendingSupport}</p>
                  <p className="text-sm text-muted-foreground mt-1">pendiente{pendingSupport !== 1 ? 's' : ''} de asignar</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
