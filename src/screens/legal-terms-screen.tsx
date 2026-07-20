import { LegalDocumentScreen } from '@/components/legal/legal-document-screen'
import { TERMS_OF_SERVICE } from '@/data/legal/documents'

interface LegalTermsScreenProps {
  onBack?: () => void
}

export function LegalTermsScreen({ onBack }: LegalTermsScreenProps) {
  return <LegalDocumentScreen document={TERMS_OF_SERVICE} onBack={onBack} />
}
