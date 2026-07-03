import type { EmergencyContact } from '@/domain/guide-models'
import { ResourceSection } from '../shared/resource-section'
import { EmergencyContactCard } from './emergency-contact-card'

interface EmergencyContactsSectionProps {
  contacts: EmergencyContact[]
  onCall: (phone: string) => void
  onCopy: (phone: string, label: string) => void
}

export function EmergencyContactsSection({ contacts, onCall, onCopy }: EmergencyContactsSectionProps) {
  return (
    <ResourceSection id="guide-emergency" title="Emergencia inmediata">
      <div className="grid gap-3 sm:grid-cols-2">
        {contacts.map((contact, i) => (
          <EmergencyContactCard
            key={contact.id}
            contact={contact}
            index={i}
            onCall={onCall}
            onCopy={onCopy}
          />
        ))}
      </div>
    </ResourceSection>
  )
}
