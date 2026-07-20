import { LegalDocumentScreen } from '@/components/legal/legal-document-screen'
import { LEGAL_NOTICE } from '@/data/legal/documents'

interface LegalNoticeScreenProps {
  onBack?: () => void
}

export function LegalNoticeScreen({ onBack }: LegalNoticeScreenProps) {
  return <LegalDocumentScreen document={LEGAL_NOTICE} onBack={onBack} />
}
