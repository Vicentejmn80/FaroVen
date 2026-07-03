import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { EmergencyProtocol } from '@/domain/guide-models'

interface ProtocolDetailProps {
  protocol: EmergencyProtocol
  onBack: () => void
}

function BlufList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'do' | 'dont' | 'tip'
}) {
  const titleClass =
    tone === 'do' ? 'text-operational' : tone === 'dont' ? 'text-critical' : 'text-info'
  const bulletClass =
    tone === 'do' ? 'bg-operational/20 text-operational' : tone === 'dont' ? 'bg-critical/20 text-critical' : 'bg-info/20 text-info'

  return (
    <GlassCard className="space-y-3">
      <p className={`text-sm font-semibold uppercase tracking-wide ${titleClass}`}>{title}</p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-ink">
            <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${bulletClass}`}>
              {tone === 'dont' ? '✕' : '✓'}
            </span>
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}

export function ProtocolDetail({ protocol, onBack }: ProtocolDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="space-y-3"
    >
      <EmergencyButton variant="glass" size="md" className="w-full justify-start" onClick={onBack}>
        <ChevronLeft className="h-4 w-4" />
        Volver a protocolos
      </EmergencyButton>

      <GlassCard className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{protocol.icon}</span>
          <div>
            <p className="text-lg font-semibold text-ink">{protocol.title}</p>
            <p className="text-sm text-ink-muted">{protocol.summary}</p>
          </div>
        </div>
      </GlassCard>

      <BlufList title="Qué hacer inmediatamente" items={protocol.bluf.doImmediately} tone="do" />
      <BlufList title="Qué NO hacer" items={protocol.bluf.doNot} tone="dont" />
      <BlufList title="Consejos adicionales" items={protocol.bluf.additionalTips} tone="tip" />
    </motion.div>
  )
}
