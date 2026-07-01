import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useFaro } from '@/store/faro-context'

/** Guía de Emergencia — biblioteca legible bajo estrés. */
export function ActivityScreen() {
  const { guideLibrary } = useFaro()
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [protocolId, setProtocolId] = useState<string | null>(null)

  const category = useMemo(
    () => guideLibrary.find((c) => c.id === categoryId) ?? null,
    [categoryId, guideLibrary],
  )
  const protocol = useMemo(
    () => category?.protocols.find((p) => p.id === protocolId) ?? null,
    [category, protocolId],
  )

  return (
    <ScreenScaffold title="Guía de emergencia" subtitle="Uso rápido">
      <div className="space-y-3 pt-2">
        {protocol ? (
          <motion.div
            key={protocol.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="space-y-3"
          >
            <EmergencyButton
              variant="glass"
              size="md"
              className="w-full justify-start"
              onClick={() => setProtocolId(null)}
            >
              <ChevronLeft className="h-4 w-4" /> Volver a {category?.title}
            </EmergencyButton>
            <GlassCard className="space-y-2.5">
              <p className="text-[16px] font-semibold text-ink">{protocol.title}</p>
              <p className="text-sm text-ink-muted">{protocol.summary}</p>
              <ol className="space-y-2 pt-1">
                {protocol.steps.map((step, idx) => (
                  <li key={step} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-medium">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </GlassCard>
          </motion.div>
        ) : category ? (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="space-y-3"
          >
            <EmergencyButton
              variant="glass"
              size="md"
              className="w-full justify-start"
              onClick={() => setCategoryId(null)}
            >
              <ChevronLeft className="h-4 w-4" /> Todas las categorías
            </EmergencyButton>
            <div className="grid gap-2">
              {category.protocols.map((p) => (
                <GlassCard key={p.id} inset={false} className="overflow-hidden">
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                    onClick={() => setProtocolId(p.id)}
                  >
                    <p className="text-[15px] font-medium text-ink">{p.title}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">{p.summary}</p>
                  </button>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {guideLibrary.map((cat, i) => (
              <motion.button
                key={cat.id}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03, ease: [0.32, 0.72, 0, 1] }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCategoryId(cat.id)}
                className="glass min-h-24 rounded-3xl p-3 text-left"
              >
                <p className="text-xl">{cat.icon}</p>
                <p className="mt-1 text-[14px] font-medium text-ink">{cat.title}</p>
                <p className="text-[11px] text-ink-subtle">{cat.protocols.length} protocolo(s)</p>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </ScreenScaffold>
  )
}
