import { motion } from 'framer-motion'
import { ChevronLeft, ExternalLink, Phone } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { OfficialResource } from '@/domain/guide-models'

interface OfficialResourceDetailProps {
  resource: OfficialResource
  onBack: () => void
  onCall: (phone: string) => void
}

export function OfficialResourceDetail({ resource, onBack, onCall }: OfficialResourceDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
    >
      <EmergencyButton variant="glass" size="md" className="w-full justify-start" onClick={onBack}>
        <ChevronLeft className="h-4 w-4" />
        Volver a recursos oficiales
      </EmergencyButton>

      <GlassCard className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{resource.icon}</span>
          <p className="text-lg font-semibold text-ink">{resource.name}</p>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">{resource.description}</p>

        {resource.website && (
          <a
            href={resource.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-info hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Sitio web oficial
          </a>
        )}

        {resource.phones && resource.phones.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Teléfonos</p>
            {resource.phones.map((phone) => (
              <EmergencyButton key={phone} variant="glass" size="md" className="w-full justify-start" onClick={() => onCall(phone)}>
                <Phone className="h-4 w-4" />
                {phone}
              </EmergencyButton>
            ))}
          </div>
        )}

        {resource.social && resource.social.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Redes oficiales</p>
            {resource.social.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="block text-sm text-info hover:underline"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
