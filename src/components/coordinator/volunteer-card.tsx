import { User, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { StatusBadge } from './status-badge'
import { timeAgo } from '@/lib/utils'
import type { OperationalStatus } from '@/domain/models'

interface Volunteer {
  id: string
  name: string
  status: OperationalStatus
  lastActivity?: Date
}

interface VolunteerCardProps {
  volunteers: Volunteer[]
}

export function VolunteerCard({ volunteers }: VolunteerCardProps) {
  if (volunteers.length === 0) {
    return (
      <GlassCard className="text-sm text-ink-muted">
        No hay voluntarios asignados actualmente.
      </GlassCard>
    )
  }

  return (
    <div className="space-y-2">
      {volunteers.map((vol) => (
        <GlassCard key={vol.id} className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
            <User className="h-5 w-5 text-ink-subtle" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{vol.name}</p>
            <div className="flex items-center gap-1.5">
              {vol.lastActivity && (
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                  <Clock className="h-3 w-3" />
                  {timeAgo(vol.lastActivity)}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={vol.status} />
        </GlassCard>
      ))}
    </div>
  )
}
