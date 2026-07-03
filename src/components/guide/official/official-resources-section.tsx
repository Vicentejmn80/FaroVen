import type { OfficialResource } from '@/domain/guide-models'
import { ResourceSection } from '../shared/resource-section'
import { ResourceCard } from '../shared/resource-card'

interface OfficialResourcesSectionProps {
  resources: OfficialResource[]
  onSelect: (id: string) => void
}

export function OfficialResourcesSection({ resources, onSelect }: OfficialResourcesSectionProps) {
  return (
    <ResourceSection id="guide-official" title="Recursos oficiales">
      <div className="grid gap-2.5">
        {resources.map((resource, i) => (
          <ResourceCard
            key={resource.id}
            icon={resource.icon}
            title={resource.name}
            subtitle={resource.description}
            index={i}
            onClick={() => onSelect(resource.id)}
          />
        ))}
      </div>
    </ResourceSection>
  )
}
