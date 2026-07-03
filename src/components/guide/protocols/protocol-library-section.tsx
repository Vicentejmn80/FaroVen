import type { EmergencyProtocol } from '@/domain/guide-models'
import { ResourceSection } from '../shared/resource-section'
import { ResourceCard } from '../shared/resource-card'

interface ProtocolLibrarySectionProps {
  protocols: EmergencyProtocol[]
  onSelect: (id: string) => void
}

export function ProtocolLibrarySection({ protocols, onSelect }: ProtocolLibrarySectionProps) {
  return (
    <ResourceSection id="guide-protocols" title="Qué hacer">
      <div className="grid grid-cols-2 gap-2.5">
        {protocols.map((protocol, i) => (
          <ResourceCard
            key={protocol.id}
            icon={protocol.icon}
            title={protocol.title}
            subtitle={protocol.summary}
            index={i}
            onClick={() => onSelect(protocol.id)}
          />
        ))}
      </div>
    </ResourceSection>
  )
}
