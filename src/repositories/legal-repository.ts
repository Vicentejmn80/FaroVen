import {
  isLegalConsentsBackendEnabled,
  isLegalConsentsMissingError,
  markLegalConsentsBackendUnavailable,
} from '@/lib/legal-consents-config'
import { supabase } from '@/lib/supabase'
import type { PendingLegalConsent } from '@/lib/legal-consent'

export const legalRepository = {
  /**
   * Persiste consentimiento en legal_consents.
   * Retorna null sin petición si el backend está deshabilitado.
   */
  async upsertConsent(userId: string, consent: PendingLegalConsent): Promise<null | void> {
    if (!isLegalConsentsBackendEnabled()) return null

    const { error } = await supabase.from('legal_consents').upsert(
      {
        user_id: userId,
        accepted_terms_at: consent.acceptedTermsAt,
        privacy_read_at: consent.privacyReadAt,
        accepted_data_processing_at: consent.dataProcessingAcceptedAt,
        accepted_privacy_at: consent.dataProcessingAcceptedAt,
        terms_version: consent.termsVersion,
        privacy_version: consent.privacyVersion,
        data_processing_version: consent.dataProcessingVersion,
        ip_address: consent.ipAddress ?? null,
        user_agent: consent.userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      if (isLegalConsentsMissingError(error.message, error.code)) {
        markLegalConsentsBackendUnavailable()
        return null
      }
      throw error
    }
  },
}
