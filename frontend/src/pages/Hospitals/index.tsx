import { useHospitals } from '@/hooks/useHospitals'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { formatDate } from '@/lib/utils'

export function HospitalsPage() {
  const { data: hospitals, isLoading, error, refetch } = useHospitals()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg sm:text-xl font-bold mb-6">Hospitales</h1>

      {isLoading && <LoadingSpinner />}

      {error && (
        <ErrorMessage
          title="Error al cargar hospitales"
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && hospitals && (
        <>
          {hospitals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay hospitales registrados.
            </p>
          ) : (
            <div className="space-y-3">
              {hospitals.map((h) => (
                <Card key={h.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{h.name}</CardTitle>
                      <Badge variant={h.current_occ && h.capacity && h.current_occ >= h.capacity * 0.9 ? 'danger' : 'success'}>
                        {h.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {h.address && (
                      <p className="text-sm text-muted-foreground mb-1">📍 {h.address}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {h.current_occ !== null && h.capacity && (
                        <span>
                          Ocupación: {h.current_occ}/{h.capacity} ({Math.round((h.current_occ / h.capacity) * 100)}%)
                        </span>
                      )}
                      {h.phone && <span>📞 {h.phone}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Actualizado: {formatDate(h.updated_at)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
