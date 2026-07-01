import { useShelters } from '@/hooks/useShelters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { formatDate, getGoogleMapsLink } from '@/lib/utils'

export function SheltersPage() {
  const { data: shelters, isLoading, error, refetch } = useShelters()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg sm:text-xl font-bold mb-6">Refugios</h1>

      {isLoading && <LoadingSpinner />}

      {error && (
        <ErrorMessage title="Error al cargar refugios" onRetry={() => refetch()} />
      )}

      {!isLoading && !error && shelters && (
        <>
          {shelters.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay refugios registrados.
            </p>
          ) : (
            <div className="space-y-3">
              {shelters.map((s) => {
                const mapLink = getGoogleMapsLink(s)
                return (
                  <Card key={s.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{s.name}</CardTitle>
                        <Badge variant={s.status === 'active' ? 'success' : 'warning'}>
                          {s.status === 'active' ? 'Activo' : 'Inactivo'}
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
                      {s.address && (
                        <p className="text-sm text-muted-foreground mb-1">📍 {s.address}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {s.current_occ !== null && (
                          <span>Personas: ~{s.current_occ}{s.capacity ? ` / ${s.capacity}` : ''}</span>
                        )}
                        {s.contact_phone && <span>📞 {s.contact_phone}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Actualizado: {formatDate(s.updated_at)}
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
