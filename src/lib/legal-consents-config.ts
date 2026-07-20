/** sessionStorage: tabla ausente o inaccesible tras un intento fallido */
const UNAVAILABLE_KEY = 'faro:legal-consents-unavailable'

function envFlagEnabled(): boolean {
  const raw = import.meta.env.VITE_LEGAL_CONSENTS_ENABLED?.trim().toLowerCase()
  return raw === 'true' || raw === '1'
}

function readUnavailableMark(): boolean {
  try {
    return sessionStorage.getItem(UNAVAILABLE_KEY) === '1'
  } catch {
    return false
  }
}

/** Marca el backend como no disponible (p. ej. 404 tras migración pendiente). */
export function markLegalConsentsBackendUnavailable(): void {
  try {
    sessionStorage.setItem(UNAVAILABLE_KEY, '1')
  } catch {
    // ignore
  }
}

/** Flag explícito en .env — sin esto no se hace ninguna petición a legal_consents. */
export function isLegalConsentsEnvEnabled(): boolean {
  return envFlagEnabled()
}

/**
 * true solo si el env lo habilita y no hay marca de indisponibilidad en sesión.
 * Usar antes de cualquier llamada REST a legal_consents.
 */
export function isLegalConsentsBackendEnabled(): boolean {
  return envFlagEnabled() && !readUnavailableMark()
}

/** Errores PostgREST cuando la relación no existe o no está expuesta. */
export function isLegalConsentsMissingError(message: string | undefined, code?: string): boolean {
  if (!message && !code) return false
  const normalized = (message ?? '').toLowerCase()
  if (code === 'PGRST205' || code === '42P01') return true
  return (
    normalized.includes('legal_consents') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find') ||
      normalized.includes('not found') ||
      normalized.includes('schema cache'))
  )
}
