import { LegalDocumentScreen } from '@/components/legal/legal-document-screen'
import { PRIVACY_POLICY } from '@/data/legal/documents'

interface LegalPrivacyScreenProps {
  onBack?: () => void
}

export function LegalPrivacyScreen({ onBack }: LegalPrivacyScreenProps) {
  return <LegalDocumentScreen document={PRIVACY_POLICY} onBack={onBack} />
}
