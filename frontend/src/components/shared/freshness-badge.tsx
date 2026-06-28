import { Badge } from '@/components/ui/badge'
import { FRESHNESS_LABELS, getFreshnessLevel, timeAgo } from '@/lib/utils'

interface FreshnessBadgeProps {
  timestamp: string
  showTime?: boolean
}

const variants = {
  fresh: 'success' as const,
  stale: 'warning' as const,
  expired: 'danger' as const,
}

export function FreshnessBadge({ timestamp, showTime = true }: FreshnessBadgeProps) {
  const level = getFreshnessLevel(timestamp)

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Badge variant={variants[level]}>{FRESHNESS_LABELS[level]}</Badge>
      {showTime && <span className="text-muted-foreground">{timeAgo(timestamp)}</span>}
    </span>
  )
}
