import { cn, timeAgo } from '@/lib/utils'
import type { FreshnessResult } from '@/services/trust-service'

interface FreshnessBadgeProps {
  freshness: FreshnessResult
  showTime?: boolean
  className?: string
}

const STATE_STYLE: Record<FreshnessResult['state'], string> = {
  fresh: 'border-operational/30 bg-operational/10 text-operational',
  stale: 'border-warning/30 bg-warning/10 text-warning',
  expired: 'border-critical/30 bg-critical/10 text-critical',
}

export function FreshnessBadge({ freshness, showTime = true, className }: FreshnessBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        STATE_STYLE[freshness.state],
        className,
      )}
    >
      <span>{freshness.emoji}</span>
      <span>{freshness.label}</span>
      {showTime && <span className="font-normal opacity-80">· {timeAgo(freshness.lastUpdated)}</span>}
    </span>
  )
}
