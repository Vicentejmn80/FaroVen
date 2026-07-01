import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FreshnessBadge } from '@/components/shared/freshness-badge'
import { formatDate, getFreshnessLevel } from '@/lib/utils'
import { PRIORITY_LABELS, PRIORITY_COLORS, type NeedWithLocation } from '@/lib/types'
import { cn } from '@/lib/utils'

const LOCATION_ICONS: Record<string, string> = {
  hospital: '🏥',
  supply_center: '📦',
  shelter: '🏠',
}

interface NeedCardProps {
  need: NeedWithLocation
}

export function NeedCard({ need }: NeedCardProps) {
  const [expanded, setExpanded] = useState(false)
  const freshness = getFreshnessLevel(need.updated_at)

  return (
    <Card className={cn(freshness === 'expired' && 'opacity-75 border-dashed')}>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{need.item_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {LOCATION_ICONS[need.location_type] ?? '📍'} {need.location_name}
            </p>
          </div>
          <Badge className={PRIORITY_COLORS[need.priority]}>
            {PRIORITY_LABELS[need.priority]}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground shrink-0 font-mono text-xs">
            {need.qty_received}/{need.qty_required} {need.unit}
          </span>
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                need.pct_covered >= 80
                  ? 'bg-green-500'
                  : need.pct_covered >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              )}
              style={{ width: `${Math.min(need.pct_covered, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium shrink-0 w-10 text-right">{need.pct_covered}%</span>
        </div>

        {need.notes && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {expanded ? 'Ocultar nota del coordinador' : 'Ver nota del coordinador →'}
            </button>
            {expanded && (
              <p className="text-xs text-muted-foreground mt-2 rounded-md bg-muted/50 p-2 leading-relaxed">
                {need.notes}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          <FreshnessBadge timestamp={need.updated_at} showTime={false} />
          {' · '}
          {formatDate(need.updated_at)}
          {freshness === 'expired' && ' · Pide confirmación al sitio antes de llevar ayuda'}
        </p>
      </CardContent>
    </Card>
  )
}
