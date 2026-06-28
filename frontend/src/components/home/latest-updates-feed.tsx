import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { useHomeFeed, type FeedItem } from '@/hooks/useHomeFeed'
import { CONFIDENCE_LABELS } from '@/lib/types'
import { FreshnessBadge } from '@/components/shared/freshness-badge'

const kindIcon: Record<FeedItem['kind'], string> = {
  bulletin: '📢',
  need: '⚡',
  person: '👤',
}

const confidenceVariant = {
  high: 'success' as const,
  medium: 'warning' as const,
  low: 'danger' as const,
}

function FeedRow({ item }: { item: FeedItem }) {
  return (
    <div className="border-b border-border last:border-0 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 mt-0.5">{kindIcon[item.kind]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-snug">{item.headline}</p>
            {item.confidence && (
              <Badge variant={confidenceVariant[item.confidence]} className="shrink-0">
                {CONFIDENCE_LABELS[item.confidence]}
              </Badge>
            )}
          </div>
          {item.detail && (
            <p className="text-sm text-muted-foreground mt-1">{item.detail}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <FreshnessBadge timestamp={item.timestamp} />
            {item.source && <span className="text-xs text-muted-foreground">Fuente: {item.source}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function LatestUpdatesFeed() {
  const { data, isLoading, error, refetch } = useHomeFeed()

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">Últimas actualizaciones</CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Cambios recientes en sitios ancla verificados · se actualiza cada minuto
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && <LoadingSpinner />}
        {error && (
          <ErrorMessage
            title="No se pudieron cargar las actualizaciones"
            onRetry={() => refetch()}
          />
        )}
        {!isLoading && !error && data && data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aún no hay actualizaciones publicadas.
          </p>
        )}
        {!isLoading && !error && data && data.length > 0 && (
          <div>{data.map((item) => <FeedRow key={item.id} item={item} />)}</div>
        )}
      </CardContent>
    </Card>
  )
}
