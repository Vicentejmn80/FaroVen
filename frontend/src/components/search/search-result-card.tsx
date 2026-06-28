import { Link } from 'react-router-dom'
import type { PersonSearchResult } from '@/lib/types'
import { STATUS_LABELS, STATUS_COLORS, CONFIDENCE_LABELS } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface SearchResultCardProps {
  result: PersonSearchResult
}

const confidenceVariant = {
  high: 'success' as const,
  medium: 'warning' as const,
  low: 'danger' as const,
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const isNotFound = result.status === 'unknown' && !result.hospital_name && !result.shelter_name

  if (isNotFound) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="font-medium mb-1">
            {result.first_name} {result.last_name}
          </p>
          <p className="text-sm text-muted-foreground">
            No se encontró información en las fuentes verificadas disponibles hasta este momento.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            📅 {formatDate(result.updated_at)}
          </p>
          <Link
            to={`/report?person_id=${result.id}`}
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            Reportar información de esta persona
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-semibold text-base">
            {result.first_name} {result.last_name}
          </p>
          <Badge
            variant={confidenceVariant[result.confidence]}
            className="shrink-0"
          >
            {CONFIDENCE_LABELS[result.confidence]}
          </Badge>
        </div>

        <p className={STATUS_COLORS[result.status]}>
          {STATUS_LABELS[result.status]}
        </p>

        {result.hospital_name && (
          <p className="text-sm mt-1">🏥 {result.hospital_name}</p>
        )}
        {result.shelter_name && (
          <p className="text-sm">🏠 {result.shelter_name}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span>📅 {formatDate(result.updated_at)}</span>
          {result.source_name && <span>📋 {result.source_name}</span>}
        </div>

        {result.notes && (
          <p className="text-xs text-muted-foreground mt-2">📝 {result.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}
