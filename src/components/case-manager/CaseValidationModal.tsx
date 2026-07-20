import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CasePriority, CaseRecord } from '@/types/case.types'

interface CaseValidationModalProps {
  open: boolean
  caseItem: CaseRecord | null
  assignments: string[]
  onClose: () => void
  onSubmit: (payload: { notes: string; priority: CasePriority; assignedTo: string }) => void
}

const PRIORITY_OPTIONS: Array<{ id: CasePriority; label: string }> = [
  { id: 'high', label: 'Alta' },
  { id: 'medium', label: 'Media' },
  { id: 'low', label: 'Baja' },
]

export function CaseValidationModal({
  open,
  caseItem,
  assignments,
  onClose,
  onSubmit,
}: CaseValidationModalProps) {
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<CasePriority>('medium')
  const [assignedTo, setAssignedTo] = useState('')

  useEffect(() => {
    if (!open || !caseItem) return
    setNotes(caseItem.notes ?? '')
    setPriority(caseItem.priority)
    setAssignedTo(caseItem.assignedTo ?? assignments[0] ?? '')
  }, [open, caseItem, assignments])

  if (!caseItem) return null

  const canSubmit = notes.trim().length >= 5 && assignedTo.trim().length > 0

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-validation-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-4 top-[12vh] z-[71] mx-auto w-full max-w-lg sm:inset-x-auto"
          >
            <GlassCard strong className="space-y-4 shadow-2xl shadow-black/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-info/15 ring-1 ring-info/25">
                    <CheckCircle2 className="h-5 w-5 text-info" />
                  </span>
                  <div>
                    <h2 id="case-validation-title" className="text-[17px] font-semibold text-ink">
                      Validar caso
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-muted">{caseItem.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-white/10 hover:text-ink"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="block space-y-2 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Notas de validación
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-info/60"
                  placeholder="Resumen de la llamada, datos confirmados, próximas acciones."
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2 text-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                    Prioridad
                  </span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as CasePriority)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/60"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id} className="bg-base-900">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                    Asignar a
                  </span>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/60"
                  >
                    {assignments.map((assignment) => (
                      <option key={assignment} value={assignment} className="bg-base-900">
                        {assignment}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <EmergencyButton
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={!canSubmit}
                  onClick={() => onSubmit({ notes: notes.trim(), priority, assignedTo })}
                >
                  Confirmar validación
                </EmergencyButton>
                <EmergencyButton variant="ghost" size="md" className="w-full" onClick={onClose}>
                  Cancelar
                </EmergencyButton>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
