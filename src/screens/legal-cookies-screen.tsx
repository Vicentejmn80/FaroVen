import { LegalDocumentScreen } from '@/components/legal/legal-document-screen'
import { COOKIES_POLICY } from '@/data/legal/documents'

interface LegalCookiesScreenProps {
  onBack?: () => void
}

export function LegalCookiesScreen({ onBack }: LegalCookiesScreenProps) {
  return <LegalDocumentScreen document={COOKIES_POLICY} onBack={onBack} showChangelog />
}
