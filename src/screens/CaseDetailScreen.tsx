import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { CaseDetailView } from '@/components/case-manager/CaseDetailView'
import type { CaseRecord } from '@/types/case.types'

interface CaseDetailScreenProps {
  caseItem: CaseRecord
  onBack: () => void
  onCall: (caseItem: CaseRecord) => void
  onValidate: (caseItem: CaseRecord) => void
  onView: (caseItem: CaseRecord) => void
}

export function CaseDetailScreen({ caseItem, onBack, onCall, onValidate, onView }: CaseDetailScreenProps) {
  return (
    <ScreenScaffold title="Detalle del caso" subtitle="Gestor de Casos" onBack={onBack}>
      <div className="pt-2">
        <CaseDetailView caseItem={caseItem} onCall={onCall} onValidate={onValidate} onView={onView} />
      </div>
    </ScreenScaffold>
  )
}
