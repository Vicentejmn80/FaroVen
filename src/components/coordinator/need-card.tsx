import { CheckCircle2, Pencil, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { PriorityBadge } from './priority-badge'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'
import type { Need } from '@/domain/models'


interface NeedCardProps {
  need: Need
  onEdit: (need: Need) => void
  onMarkCovered: (needId: string) => void
  isMarking?: boolean
}

export function NeedCard({ need, onEdit, onMarkCovered, isMarking }: NeedCardProps) {
  const coverage = Math.round((need.available / Math.max(need.required, 1)) * 100)
  const covered = need.available >= need.required && need.required > 0
  const isPending = need.status === 'pending_closure'
  const isResolved = need.status === 'resolved'

  const coverageColor = isPending
    ? 'text-warning'
    : covered
      ? 'text-operational'
      : coverage < 40
        ? 'text-critical'
        : 'text-warning'

  const barColor = covered ? 'bg-operational' : coverage < 40 ? 'bg-critical' : 'bg-warning'

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <NeedItemLabel name={need.type} className="text-sm font-medium text-ink" />
            <PriorityBadge priority={need.priority} />
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            {need.available}/{need.required} unidades
          </p>
        </div>
        <span className={cn('text-xs font-medium', coverageColor)}>
          {isPending ? 'Cierre pendiente' : isResolved ? 'Resuelta' : `${coverage}%`}
        </span>
      </div>

      {!isResolved && (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${Math.min(100, coverage)}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
          <Clock className="h-3 w-3" />
          {timeAgo(need.updatedAt)}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <EmergencyButton
            variant="glass"
            size="sm"
            disabled={isPending || isResolved}
            onClick={() => onEdit(need)}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </EmergencyButton>
          {!covered && !isPending && !isResolved && (
            <EmergencyButton
              variant="glass"
              size="sm"
              disabled={isMarking}
              onClick={() => onMarkCovered(need.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Cubrir
            </EmergencyButton>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
