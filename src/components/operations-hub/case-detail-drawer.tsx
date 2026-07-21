import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CaseDomain, CaseDomainEvent, PipelineStage } from '@/domain/case-lifecycle.types'
import type { AssignmentSuggestion } from '@/types/operations-hub.types'
import { CaseDetailPanel } from './case-detail-panel'
import { EmergencyButton } from '@/components/ui/emergency-button'

interface CaseDetailDrawerProps {
  open: boolean
  caseItem: CaseDomain | null
  timeline?: CaseDomainEvent[]
  suggestions?: AssignmentSuggestion[]
  onClose: () => void
  onTransition?: (caseId: string, toStage: PipelineStage, comment?: string) => void
  onAssign?: (centerId: string) => void
  isTransitioning?: boolean
}

/**
 * Panel lateral deslizante (drawer) para detalle operativo del caso.
 * Desktop: anclado a la derecha. Móvil: hoja casi a pantalla completa.
 */
export function CaseDetailDrawer({
  open,
  caseItem,
  timeline,
  suggestions,
  onClose,
  onTransition,
  onAssign,
  isTransitioning,
}: CaseDetailDrawerProps) {
  return (
    <AnimatePresence>
      {open && caseItem && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Detalle del caso"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              'absolute inset-y-0 right-0 z-50 flex w-full flex-col',
              'border-l border-white/[0.08] shadow-[-12px_0_40px_rgba(0,0,0,0.45)]',
              'bg-gradient-to-b from-[#121c30]/96 to-[#0a1220]/98 backdrop-blur-2xl',
              'sm:max-w-md lg:max-w-[420px]',
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  Ficha operativa
                </p>
                <p className="truncate text-sm font-medium text-ink">{caseItem.title}</p>
              </div>
              <EmergencyButton variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </EmergencyButton>
            </div>

            <div className="min-h-0 flex-1">
              <CaseDetailPanel
                caseItem={caseItem}
                timeline={timeline}
                suggestions={suggestions}
                onTransition={onTransition}
                onAssign={onAssign}
                isTransitioning={isTransitioning}
                dense
              />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
