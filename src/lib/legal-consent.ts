import { LEGAL_VERSIONS } from '@/data/legal/documents'

const PENDING_CONSENT_KEY = 'faro:legal-consent-pending'

export interface PendingLegalConsent {
  acceptedTermsAt: string
  privacyReadAt: string
  dataProcessingAcceptedAt: string
  termsVersion: string
  privacyVersion: string
  dataProcessingVersion: string
  ipAddress?: string | null
  userAgent?: string | null
}

export function setPendingLegalConsent(consent: PendingLegalConsent) {
  localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(consent))
}

export function readPendingLegalConsent(): PendingLegalConsent | null {
  try {
    const raw = localStorage.getItem(PENDING_CONSENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingLegalConsent
  } catch {
    return null
  }
}

export function clearPendingLegalConsent() {
  localStorage.removeItem(PENDING_CONSENT_KEY)
}

/** Consentimiento al registrarse: Términos + Privacidad (2 casillas en UI). */
export function buildSignupConsent(now = new Date()): PendingLegalConsent {
  const iso = now.toISOString()
  return {
    acceptedTermsAt: iso,
    privacyReadAt: iso,
    /** Misma marca que privacidad — la UI ya no pide autorización separada. */
    dataProcessingAcceptedAt: iso,
    termsVersion: LEGAL_VERSIONS.terms.version,
    privacyVersion: LEGAL_VERSIONS.privacy.version,
    dataProcessingVersion: LEGAL_VERSIONS.privacy.version,
  }
}
