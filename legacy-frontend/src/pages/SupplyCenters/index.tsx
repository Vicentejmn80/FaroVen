import { useSupplyCenters } from '@/hooks/useSupplyCenters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { formatDate, getGoogleMapsLink } from '@/lib/utils'

export function SupplyCentersPage() {
  const { data: centers, isLoading, error, refetch } = useSupplyCenters()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg sm:text-xl font-bold mb-6">Centros de Acopio</h1>

      {isLoading && <LoadingSpinner />}

      {error && (
        <ErrorMessage title="Error al cargar centros de acopio" onRetry={() => refetch()} />
      )}

      {!isLoading && !error && centers && (
        <>
          {centers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay centros de acopio registrados.
            </p>
          ) : (
            <div className="space-y-3">
              {centers.map((c) => {
                const mapLink = getGoogleMapsLink(c)
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{c.name}</CardTitle>
                        <Badge variant={c.status === 'active' ? 'success' : 'warning'}>
                          {c.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {mapLink && (
                        <div className="mb-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={mapLink} target="_blank" rel="noreferrer">
                              Ver en Google Maps
                            </a>
                          </Button>
                        </div>
                      )}
                      {c.address && (
                        <p className="text-sm text-muted-foreground mb-1">📍 {c.address}</p>
                      )}
                      {c.schedule && (
                        <p className="text-sm text-muted-foreground mb-1">🕐 {c.schedule}</p>
                      )}
                      {c.accepts && c.accepts.length > 0 && (
                        <div className="mb-1">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Reciben:</p>
                          <div className="flex flex-wrap gap-1">
                            {c.accepts.map((item) => (
                              <span key={item} className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {c.not_accepts && c.not_accepts.length > 0 && (
                        <div className="mb-1">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">No necesitan:</p>
                          <div className="flex flex-wrap gap-1">
                            {c.not_accepts.map((item) => (
                              <span key={item} className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {c.contact_phone && <p className="text-sm text-muted-foreground">📞 {c.contact_phone}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        Actualizado: {formatDate(c.updated_at)}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
