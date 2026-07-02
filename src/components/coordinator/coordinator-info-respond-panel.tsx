import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { textareaClassName } from '@/components/faro/flow-sheet'
import { formatAuthError } from '@/lib/auth-errors'
import type { CoordinatorRequestRow } from '@/repositories/auth-types'

interface CoordinatorInfoRespondPanelProps {
  request: CoordinatorRequestRow
  onSubmit: (response: string) => Promise<void>
  submitting?: boolean
}

export function CoordinatorInfoRespondPanel({
  request,
  onSubmit,
  submitting,
}: CoordinatorInfoRespondPanelProps) {
  const [response, setResponse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const trimmed = response.trim()
  const canSend = trimmed.length >= 10 && !submitting

  async function handleSubmit() {
    if (!canSend) return
    setError(null)
    try {
      await onSubmit(trimmed)
      setSent(true)
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo enviar'))
    }
  }

  if (sent) {
    return (
      <GlassCard className="space-y-2 text-center">
        <p className="text-[15px] font-semibold text-ink">Información enviada</p>
        <p className="text-sm text-ink-muted">
          El administrador recibirá tu respuesta y continuará revisando tu solicitud.
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3 border-warning/25 bg-warning/5">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-ink">Necesitamos más información</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {request.info_request_message}
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="text-sm text-ink-muted">
          Amplía tu experiencia, tu rol en el centro y cualquier detalle que ayude a validar tu solicitud.
        </p>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Tu respuesta
          </span>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={5}
            placeholder="Describe tu experiencia en el centro, responsabilidades actuales y por qué puedes coordinarlo…"
            className={textareaClassName}
          />
        </label>
        {error && <p className="text-sm text-critical">{error}</p>}
        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canSend}
          onClick={() => void handleSubmit()}
        >
          <Send className="h-4 w-4" /> {submitting ? 'Enviando…' : 'Enviar información'}
        </EmergencyButton>
      </GlassCard>
    </div>
  )
}
