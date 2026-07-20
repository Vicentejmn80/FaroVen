import { useState } from 'react'
import { Copy, Mail, Phone, UserRound } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { fieldClassName, textareaClassName } from '@/components/faro/flow-sheet'
import type { FaroTeamContact, FeedbackCategory } from '@/domain/guide-models'
import { cn } from '@/lib/utils'
import { ResourceSection } from '../shared/resource-section'

const CATEGORIES: Array<{ id: FeedbackCategory; label: string }> = [
  { id: 'bug', label: 'Reportar error' },
  { id: 'suggestion', label: 'Sugerir mejora' },
  { id: 'incorrect_info', label: 'Info incorrecta' },
]

interface ContactFormSectionProps {
  teamContact: FaroTeamContact
  onSubmit: (input: { category: FeedbackCategory; message: string; email?: string }) => Promise<void>
  onCall?: (phone: string) => void
  onCopy?: (value: string, label: string) => void
  busy?: boolean
}

export function ContactFormSection({
  teamContact,
  onSubmit,
  onCall,
  onCopy,
  busy,
}: ContactFormSectionProps) {
  const [category, setCategory] = useState<FeedbackCategory>('suggestion')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')

  const mailtoHref = `mailto:${teamContact.email}?subject=${encodeURIComponent('Contacto FARO')}`

  async function handleSubmit() {
    if (message.trim().length < 10) return
    await onSubmit({ category, message: message.trim(), email: email.trim() || undefined })
    setMessage('')
  }

  return (
    <ResourceSection id="guide-contact" title="Contactar al equipo FARO">
      <GlassCard className="mb-3 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-info/15 text-info">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{teamContact.name}</p>
            <p className="text-sm text-ink-muted">{teamContact.role}</p>
          </div>
        </div>

        <div className="space-y-2">
          {teamContact.phone && teamContact.phoneDisplay && onCall && onCopy && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs text-ink-subtle">Teléfono</p>
                <p className="font-mono text-sm font-medium text-ink">{teamContact.phoneDisplay}</p>
              </div>
              <div className="flex gap-2">
                <EmergencyButton variant="primary" size="sm" onClick={() => onCall(teamContact.phone!)}>
                  <Phone className="h-4 w-4" />
                  Llamar
                </EmergencyButton>
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  onClick={() => onCopy(teamContact.phone!, 'Teléfono')}
                >
                  <Copy className="h-4 w-4" />
                </EmergencyButton>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-ink-subtle">Correo</p>
              <a href={mailtoHref} className="text-sm font-medium text-info hover:underline">
                {teamContact.email}
              </a>
            </div>
            <a
              href={mailtoHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-ink transition-colors hover:bg-white/10"
            >
              <Mail className="h-4 w-4" />
              Escribir
            </a>
          </div>
        </div>

        {teamContact.emailNote && (
          <p className="text-xs leading-relaxed text-ink-subtle">{teamContact.emailNote}</p>
        )}
      </GlassCard>

      <GlassCard className="space-y-4">
        <p className="text-sm text-ink-muted">
          O envía un mensaje desde la app — llegará como notificación al equipo FARO.
        </p>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                category === cat.id
                  ? 'border-info/60 bg-info-soft text-ink'
                  : 'border-white/10 bg-white/[0.04] text-ink-muted',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Mensaje</span>
          <textarea
            className={textareaClassName}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Cuéntanos qué necesitas…"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Tu correo (opcional)</span>
          <input
            className={fieldClassName}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
        </label>

        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={busy || message.trim().length < 10}
          onClick={handleSubmit}
        >
          {busy ? 'Enviando…' : 'Enviar mensaje'}
        </EmergencyButton>
      </GlassCard>
    </ResourceSection>
  )
}
