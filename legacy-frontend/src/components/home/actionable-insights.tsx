import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { useActionableInsights } from '@/hooks/useActionableInsights'

export function ActionableInsights() {
  const { data, isLoading, error, refetch } = useActionableInsights()

  return (
    <div className="grid gap-3 sm:grid-cols-2 w-full">
      <Card className="border-green-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>✅</span> Llevar ayuda aquí
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Solo sitios ancla con necesidad crítica/alta y cobertura baja
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingSpinner />}
          {error && (
            <ErrorMessage title="Error al cargar recomendaciones" onRetry={() => refetch()} />
          )}
          {!isLoading && !error && data?.helpHere.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay alertas críticas activas en este momento.
            </p>
          )}
          {!isLoading && !error && data && data.helpHere.length > 0 && (
            <ul className="space-y-3">
              {data.helpHere.map((item) => (
                <li key={item.id} className="text-sm">
                  <p className="font-medium">{item.locationName}</p>
                  <p className="text-muted-foreground">
                    {item.itemName} · {item.priorityLabel} · {item.detail} ({item.pctCovered}%)
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>⛔</span> Evitar saturar
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Necesidades al 90%+ o insumos que el acopio ya no recibe (actualizado por coordinador)
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingSpinner />}
          {error && (
            <ErrorMessage title="Error al cargar alertas" onRetry={() => refetch()} />
          )}
          {!isLoading && !error && data?.avoidSaturate.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin alertas de saturación por ahora.
            </p>
          )}
          {!isLoading && !error && data && data.avoidSaturate.length > 0 && (
            <ul className="space-y-3">
              {data.avoidSaturate.map((item) => (
                <li key={item.id} className="text-sm">
                  <p className="font-medium">{item.locationName}</p>
                  <p className="text-muted-foreground">{item.reason}</p>
                  {item.items && item.items.length > 0 && (
                    <p className="text-xs text-orange-500 mt-1">
                      No llevar: {item.items.join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
