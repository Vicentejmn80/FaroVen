import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import type { FaqItem } from '@/domain/guide-models'
import { cn } from '@/lib/utils'
import { ResourceSection } from '../shared/resource-section'

interface FaqSectionProps {
  items: FaqItem[]
}

export function FaqSection({ items }: FaqSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <ResourceSection id="guide-faq" title="Preguntas frecuentes">
      <div className="space-y-2">
        {items.map((item) => {
          const isOpen = openId === item.id
          return (
            <GlassCard key={item.id} inset={false} className="overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-ink">{item.question}</span>
                <ChevronDown
                  className={cn('h-4 w-4 shrink-0 text-ink-faint transition-transform', isOpen && 'rotate-180')}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="border-t border-white/[0.06] px-4 py-3 text-sm leading-relaxed text-ink-muted">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          )
        })}
      </div>
    </ResourceSection>
  )
}
