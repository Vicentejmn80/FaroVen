import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { PublicSummaryMessage } from '@/services/public-summary-engine'
import { cn } from '@/lib/utils'

interface CenterPublicSummaryProps {
  messages: PublicSummaryMessage[]
  className?: string
}

const TONE_STYLE: Record<
  PublicSummaryMessage['tone'],
  { container: string; icon: typeof Info; iconClass: string }
> = {
  critical: {
    container: 'border-critical/20 bg-critical/[0.04]',
    icon: AlertTriangle,
    iconClass: 'text-critical',
  },
  warning: {
    container: 'border-warning/20 bg-warning/[0.04]',
    icon: AlertTriangle,
    iconClass: 'text-warning',
  },
  neutral: {
    container: 'border-white/[0.06] bg-white/[0.02]',
    icon: Info,
    iconClass: 'text-ink-muted',
  },
  positive: {
    container: 'border-success/20 bg-success/[0.04]',
    icon: CheckCircle2,
    iconClass: 'text-success',
  },
}

export function CenterPublicSummary({ messages, className }: CenterPublicSummaryProps) {
  if (messages.length === 0) return null

  return (
    <div className={cn('space-y-1.5', className)}>
      {messages.map((msg) => {
        const style = TONE_STYLE[msg.tone]
        const Icon = style.icon
        return (
          <div
            key={msg.id}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5',
              style.container,
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconClass)} strokeWidth={2} />
            <p className="text-sm leading-snug text-ink">{msg.text}</p>
          </div>
        )
      })}
    </div>
  )
}
