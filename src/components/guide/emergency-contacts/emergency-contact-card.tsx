import { Copy, Phone } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { EmergencyContact } from '@/domain/guide-models'
import { ResourceCard } from '../shared/resource-card'

interface EmergencyContactCardProps {
  contact: EmergencyContact
  index: number
  onCall: (phone: string) => void
  onCopy: (phone: string, label: string) => void
}

export function EmergencyContactCard({ contact, index, onCall, onCopy }: EmergencyContactCardProps) {
  return (
    <ResourceCard
      icon={contact.icon}
      title={contact.name}
      subtitle={contact.description}
      index={index}
      accent={index === 0 ? 'critical' : 'default'}
    >
      <p className="mt-2 font-mono text-lg font-semibold tracking-wide text-ink">{contact.phone}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <EmergencyButton variant="primary" size="md" className="w-full" onClick={() => onCall(contact.phone)}>
          <Phone className="h-4 w-4" />
          Llamar
        </EmergencyButton>
        <EmergencyButton
          variant="glass"
          size="md"
          className="w-full"
          onClick={() => onCopy(contact.phone, contact.name)}
        >
          <Copy className="h-4 w-4" />
          Copiar
        </EmergencyButton>
      </div>
    </ResourceCard>
  )
}
