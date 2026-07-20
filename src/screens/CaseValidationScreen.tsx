import { useEffect, useState } from 'react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CasePriority, CaseRecord } from '@/types/case.types'

interface CaseValidationScreenProps {
  caseItem: CaseRecord
  assignments: string[]
  onBack: () => void
  onSubmit: (payload: { notes: string; priority: CasePriority; assignedTo: string }) => void
}

const PRIORITY_OPTIONS: Array<{ id: CasePriority; label: string }> = [
  { id: 'high', label: 'Alta' },
  { id: 'medium', label: 'Media' },
  { id: 'low', label: 'Baja' },
]

export function CaseValidationScreen({ caseItem, assignments, onBack, onSubmit }: CaseValidationScreenProps) {
  const [notes, setNotes] = useState(caseItem.notes ?? '')
  const [priority, setPriority] = useState<CasePriority>(caseItem.priority)
  const [assignedTo, setAssignedTo] = useState(caseItem.assignedTo ?? assignments[0] ?? '')

  useEffect(() => {
    setNotes(caseItem.notes ?? '')
    setPriority(caseItem.priority)
    setAssignedTo(caseItem.assignedTo ?? assignments[0] ?? '')
  }, [caseItem, assignments])

  const canSubmit = notes.trim().length >= 5 && assignedTo.trim().length > 0

  return (
    <ScreenScaffold title="Validar caso" subtitle="Gestor de Casos" onBack={onBack}>
      <div className="space-y-4 pt-2">
        <GlassCard className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">{caseItem.title}</h2>
          <p className="text-sm text-ink-subtle">{caseItem.description}</p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <label className="block space-y-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Notas de validación
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-info/60"
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
            <EmergencyButton variant="glass" size="md" className="w-full" onClick={onBack}>
              Cancelar
            </EmergencyButton>
          </div>
        </GlassCard>
      </div>
    </ScreenScaffold>
  )
}
