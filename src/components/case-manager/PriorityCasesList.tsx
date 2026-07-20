import { SectionTitle } from '@/components/faro/section-title'
import type { CaseRecord } from '@/types/case.types'
import { CaseCard } from './CaseCard'

interface PriorityCasesListProps {
  cases: CaseRecord[]
  onCall: (caseItem: CaseRecord) => void
  onValidate: (caseItem: CaseRecord) => void
  onView: (caseItem: CaseRecord) => void
}

export function PriorityCasesList({ cases, onCall, onValidate, onView }: PriorityCasesListProps) {
  return (
    <section className="space-y-3">
      <SectionTitle>Casos prioritarios</SectionTitle>
      <div className="space-y-2">
        {cases.length ? (
          cases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              caseItem={caseItem}
              onCall={onCall}
              onValidate={onValidate}
              onView={onView}
              showStatus={false}
            />
          ))
        ) : (
          <p className="text-sm text-ink-subtle">No hay casos críticos pendientes.</p>
        )}
      </div>
    </section>
  )
}
