import { useState } from 'react'
import { Mail, Scale, Shield, Users, Wrench } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { fieldClassName, textareaClassName } from '@/components/faro/flow-sheet'
import { CONTACT_PAGE_CONTENT } from '@/data/legal/documents'
import { FARO_LEGAL_META, activeContactEmail } from '@/data/legal/faro-legal-meta'
import type { FeedbackCategory } from '@/domain/guide-models'
import { cn } from '@/lib/utils'

type InquiryType = 'general' | 'support' | 'privacy' | 'legal'

const INQUIRY_LABELS: Record<InquiryType, string> = {
  general: 'Consulta general',
  support: 'Soporte técnico',
  privacy: 'Privacidad y datos',
  legal: 'Asuntos legales',
}

const INQUIRY_ICONS: Record<InquiryType, typeof Mail> = {
  general: Mail,
  support: Wrench,
  privacy: Shield,
  legal: Scale,
}

function inquiryEmail(type: InquiryType): string {
  const map = { general: 'contact', support: 'support', privacy: 'privacy', legal: 'legal' } as const
  return activeContactEmail(map[type])
}

function mapInquiryToFeedback(type: InquiryType): FeedbackCategory {
  if (type === 'support') return 'bug'
  if (type === 'privacy') return 'incorrect_info'
  return 'suggestion'
}

interface LegalContactSectionProps {
  onSubmit: (input: { category: FeedbackCategory; message: string; email?: string }) => Promise<void>
  busy?: boolean
}

export function LegalContactSection({ onSubmit, busy }: LegalContactSectionProps) {
  const [inquiryType, setInquiryType] = useState<InquiryType>('general')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const selectedLabel = INQUIRY_LABELS[inquiryType]
  const selectedEmail = inquiryEmail(inquiryType)
  const mailtoHref = `mailto:${selectedEmail}?subject=${encodeURIComponent(`[FARO] ${selectedLabel}`)}`

  async function handleSubmit() {
    if (message.trim().length < 10) return
    const prefix = `[${selectedLabel}${name.trim() ? ` · ${name.trim()}` : ''}] `
    await onSubmit({
      category: mapInquiryToFeedback(inquiryType),
      message: prefix + message.trim(),
      email: email.trim() || undefined,
    })
    setMessage('')
  }

  const intro = CONTACT_PAGE_CONTENT.sections.find((s) => s.id === 'intro')
  const channels = CONTACT_PAGE_CONTENT.sections.find((s) => s.id === 'channels')
  const privacyNotice = CONTACT_PAGE_CONTENT.sections.find((s) => s.id === 'privacy-notice')

  return (
    <div className="space-y-4">
      {intro && (
        <GlassCard className="space-y-2">
          <p className="text-sm leading-relaxed text-ink-muted">{intro.body}</p>
        </GlassCard>
      )}

      <GlassCard className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-info/15 text-info">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{FARO_LEGAL_META.teamName}</p>
            <p className="text-sm text-ink-muted">{FARO_LEGAL_META.projectNature}</p>
            <p className="text-xs text-ink-subtle">{FARO_LEGAL_META.locationLabel}</p>
          </div>
        </div>

        {channels?.bullets && (
          <ul className="list-inside list-disc space-y-1.5 text-sm text-ink-muted">
            {channels.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          {(Object.keys(INQUIRY_LABELS) as InquiryType[]).map((type) => {
            const Icon = INQUIRY_ICONS[type]
            const addr = inquiryEmail(type)
            return (
              <div
                key={type}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs text-ink-subtle">{INQUIRY_LABELS[type]}</p>
                  <a href={`mailto:${addr}`} className="text-sm font-medium text-info hover:underline">
                    {addr}
                  </a>
                </div>
                <a
                  href={`mailto:${addr}?subject=${encodeURIComponent(`[FARO] ${INQUIRY_LABELS[type]}`)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-ink"
                >
                  <Icon className="h-3.5 w-3.5" />
                  Escribir
                </a>
              </div>
            )
          })}
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <p className="text-sm text-ink-muted">O envía un mensaje desde la app — llegará al {FARO_LEGAL_META.teamName}.</p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(INQUIRY_LABELS) as InquiryType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setInquiryType(type)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                inquiryType === type
                  ? 'border-info/60 bg-info-soft text-ink'
                  : 'border-white/10 bg-white/[0.04] text-ink-muted',
              )}
            >
              {INQUIRY_LABELS[type]}
            </button>
          ))}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Nombre</span>
          <input
            className={fieldClassName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Correo electrónico</span>
          <input
            className={fieldClassName}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Mensaje</span>
          <textarea
            className={textareaClassName}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Cuéntanos en qué podemos ayudarte…"
          />
        </label>

        {privacyNotice && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-ink-subtle">
            {privacyNotice.body}
          </p>
        )}

        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={busy || message.trim().length < 10}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Enviando…' : 'Enviar mensaje'}
        </EmergencyButton>

        <p className="text-center text-xs text-ink-faint">
          También puedes escribir directamente a{' '}
          <a href={mailtoHref} className="text-info hover:underline">
            {selectedEmail}
          </a>
          . Consulta la{' '}
          <button
            type="button"
            className="text-info hover:underline"
            onClick={() => window.dispatchEvent(new CustomEvent('faro:open-legal', { detail: { doc: 'privacy' } }))}
          >
            Política de Privacidad
          </button>
          .
        </p>
      </GlassCard>
    </div>
  )
}
