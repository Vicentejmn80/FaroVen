import { buildSignupConsent, clearPendingLegalConsent, readPendingLegalConsent, setPendingLegalConsent } from '@/lib/legal-consent'
import { resolveConsentClientMetadata } from '@/lib/legal-client-meta'
import {
  isLegalConsentsBackendEnabled,
  isLegalConsentsEnvEnabled,
  markLegalConsentsBackendUnavailable,
} from '@/lib/legal-consents-config'
import type { PendingLegalConsent } from '@/lib/legal-consent'
import { legalRepository } from '@/repositories/legal-repository'

async function enrichConsent(consent: PendingLegalConsent): Promise<PendingLegalConsent> {
  const { ipAddress, userAgent } = await resolveConsentClientMetadata()
  return {
    ...consent,
    ipAddress: consent.ipAddress ?? ipAddress,
    userAgent: consent.userAgent ?? userAgent,
  }
}

export const legalService = {
  /** true si VITE_LEGAL_CONSENTS_ENABLED está activo y el backend no está marcado como ausente */
  isBackendEnabled(): boolean {
    return isLegalConsentsBackendEnabled()
  },

  /** true si el flag de entorno está activo (sin comprobar sesión) */
  isConfigured(): boolean {
    return isLegalConsentsEnvEnabled()
  },

  setConsentPending(consent = buildSignupConsent()) {
    setPendingLegalConsent(consent)
  },

  /**
   * Sincroniza consentimiento pendiente en localStorage → legal_consents.
   * Retorna null sin red si el servicio está deshabilitado o la tabla no está disponible.
   */
  async syncPendingConsent(userId?: string | null): Promise<null | void> {
    if (!userId) return null
    if (!isLegalConsentsBackendEnabled()) return null

    const pending = readPendingLegalConsent()
    if (!pending) return null

    try {
      const enriched = await enrichConsent(pending)
      const synced = await legalRepository.upsertConsent(userId, enriched)
      if (synced === null) return null
      clearPendingLegalConsent()
    } catch {
      markLegalConsentsBackendUnavailable()
    }

    return null
  },
}
