import { useCallback, useState } from 'react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { LegalContactSection } from '@/components/legal/legal-contact-section'
import { CONTACT_PAGE_CONTENT } from '@/data/legal/documents'
import { guideService } from '@/services/guide-service'
import { useToast } from '@/store/toast-context'
import { humanizeSupabaseError } from '@/lib/supabase-errors'

interface ContactScreenProps {
  onBack?: () => void
}

export function ContactScreen({ onBack }: ContactScreenProps) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  const handleFeedback = useCallback(
    async (input: { category: Parameters<typeof guideService.submitFeedback>[0]['category']; message: string; email?: string }) => {
      setBusy(true)
      try {
        await guideService.submitFeedback(input)
        showToast('Mensaje enviado. El equipo FARO fue notificado.', 'success')
      } catch (err) {
        showToast(humanizeSupabaseError(err), 'warning')
      } finally {
        setBusy(false)
      }
    },
    [showToast],
  )

  return (
    <ScreenScaffold
      title={CONTACT_PAGE_CONTENT.title}
      subtitle={CONTACT_PAGE_CONTENT.subtitle}
      onBack={onBack}
    >
      <div className="space-y-4 pt-2">
        <LegalContactSection onSubmit={handleFeedback} busy={busy} />
      </div>
    </ScreenScaffold>
  )
}
