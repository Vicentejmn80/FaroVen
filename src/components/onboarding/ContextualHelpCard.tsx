import { X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { CONTEXTUAL_HELP } from '@/lib/onboarding-content'
import type { OnboardingModuleId } from '@/lib/onboarding-storage'
import { useContextualHelp } from '@/hooks/useContextualHelp'
import { cn } from '@/lib/utils'

interface ContextualHelpCardProps {
  moduleId: OnboardingModuleId
  className?: string
}

/** Tarjeta de ayuda que aparece solo la primera vez en cada módulo. */
export function ContextualHelpCard({ moduleId, className }: ContextualHelpCardProps) {
  const { visible, dismiss } = useContextualHelp(moduleId)
  const content = CONTEXTUAL_HELP[moduleId]

  if (!visible) return null

  return (
    <GlassCard
      inset={false}
      className={cn('relative border-info/20 bg-info/[0.06] p-3.5', className)}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-full p-1.5 text-ink-subtle hover:bg-white/10 hover:text-ink"
        aria-label="Cerrar ayuda"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="pr-6 text-xs font-semibold uppercase tracking-[0.12em] text-info">{content.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{content.body}</p>
      {content.tip && (
        <p className="mt-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs text-ink-subtle">{content.tip}</p>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="mt-2.5 text-xs font-medium text-info hover:underline"
      >
        Entendido
      </button>
    </GlassCard>
  )
}
