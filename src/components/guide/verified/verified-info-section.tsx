import { ShieldCheck } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import type { VerifiedAnnouncement } from '@/domain/guide-models'
import { timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ResourceSection } from '../shared/resource-section'

interface VerifiedInfoSectionProps {
  announcements: VerifiedAnnouncement[]
}

const KIND_STYLE: Record<VerifiedAnnouncement['kind'], string> = {
  alert: 'border-critical/30 bg-critical/10 text-critical',
  operational: 'border-operational/30 bg-operational/10 text-operational',
  info: 'border-info/30 bg-info/10 text-info',
}

export function VerifiedInfoSection({ announcements }: VerifiedInfoSectionProps) {
  return (
    <ResourceSection id="guide-verified" title="Información verificada">
      <p className="mb-3 px-1 text-sm text-ink-muted">
        Solo comunicados confirmados por coordinadores o administradores. Sin rumores.
      </p>
      <div className="space-y-2.5">
        {announcements.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-ink-subtle">No hay comunicados verificados recientes.</p>
          </GlassCard>
        ) : (
          announcements.map((item) => (
            <GlassCard key={item.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-operational" />
                  <p className="font-semibold text-ink">{item.title}</p>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase', KIND_STYLE[item.kind])}>
                  Verificado
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{item.body}</p>
              <p className="text-xs text-ink-subtle">
                {item.source} · {timeAgo(new Date(item.verifiedAt))}
              </p>
            </GlassCard>
          ))
        )}
      </div>
    </ResourceSection>
  )
}
