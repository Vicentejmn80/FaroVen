import { SectionTitle } from '@/components/faro/section-title'
import type { CaseFilterItem, CaseListFilter, CaseRecord } from '@/types/case.types'
import { CaseCard } from './CaseCard'
import { CaseFilterTabs } from './CaseFilterTabs'

interface AllCasesListProps {
  cases: CaseRecord[]
  filters: CaseFilterItem[]
  activeFilter: CaseListFilter
  onChangeFilter: (filter: CaseListFilter) => void
  onCall: (caseItem: CaseRecord) => void
  onValidate: (caseItem: CaseRecord) => void
  onView: (caseItem: CaseRecord) => void
}

export function AllCasesList({
  cases,
  filters,
  activeFilter,
  onChangeFilter,
  onCall,
  onValidate,
  onView,
}: AllCasesListProps) {
  return (
    <section className="space-y-3">
      <SectionTitle>Todos los casos</SectionTitle>
      <CaseFilterTabs items={filters} active={activeFilter} onChange={onChangeFilter} />
      <div className="space-y-2">
        {cases.length ? (
          cases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              caseItem={caseItem}
              onCall={onCall}
              onValidate={onValidate}
              onView={onView}
            />
          ))
        ) : (
          <p className="text-sm text-ink-subtle">No hay casos disponibles para este filtro.</p>
        )}
      </div>
    </section>
  )
}
