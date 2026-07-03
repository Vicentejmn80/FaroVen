import { GlassCard } from '@/components/ui/glass-card'
import type { FaroAboutBlock } from '@/domain/guide-models'
import { ResourceSection } from '../shared/resource-section'

interface FaroAboutSectionProps {
  blocks: FaroAboutBlock[]
}

export function FaroAboutSection({ blocks }: FaroAboutSectionProps) {
  return (
    <ResourceSection id="guide-about" title="Ayuda sobre FARO">
      <div className="space-y-2.5">
        {blocks.map((block) => (
          <GlassCard key={block.id} className="space-y-1.5">
            <p className="font-semibold text-ink">{block.title}</p>
            <p className="text-sm leading-relaxed text-ink-muted">{block.body}</p>
          </GlassCard>
        ))}
      </div>
    </ResourceSection>
  )
}
