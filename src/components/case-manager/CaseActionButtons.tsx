import { CheckCircle2, Eye, PhoneCall } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { CaseRecord } from '@/types/case.types'
import { cn } from '@/lib/utils'

interface CaseActionButtonsProps {
  caseItem: CaseRecord
  onCall: (caseItem: CaseRecord) => void
  onValidate: (caseItem: CaseRecord) => void
  onView: (caseItem: CaseRecord) => void
  compact?: boolean
}

export function CaseActionButtons({
  caseItem,
  onCall,
  onValidate,
  onView,
  compact = false,
}: CaseActionButtonsProps) {
  const baseClass = compact ? 'h-9 px-2 text-xs' : 'h-10 px-3 text-xs'
  return (
    <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
      <EmergencyButton
        variant="glass"
        size="md"
        className={cn(baseClass, 'gap-1.5')}
        onClick={() => onCall(caseItem)}
      >
        <PhoneCall className="h-4 w-4" /> Llamar
      </EmergencyButton>
      <EmergencyButton
        variant="primary"
        size="md"
        className={cn(baseClass, 'gap-1.5')}
        onClick={() => onValidate(caseItem)}
      >
        <CheckCircle2 className="h-4 w-4" /> Validar
      </EmergencyButton>
      <EmergencyButton
        variant="glass"
        size="md"
        className={cn(baseClass, 'gap-1.5')}
        onClick={() => onView(caseItem)}
      >
        <Eye className="h-4 w-4" /> Ver
      </EmergencyButton>
    </div>
  )
}
