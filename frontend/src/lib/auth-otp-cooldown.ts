const COOLDOWN_SECONDS = 60
const STORAGE_PREFIX = 'otp-cooldown:'

export function getOtpCooldownRemaining(email: string): number {
  const key = `${STORAGE_PREFIX}${email.trim().toLowerCase()}`
  const raw = localStorage.getItem(key)
  if (!raw) return 0

  const expiresAt = Number(raw)
  if (Number.isNaN(expiresAt)) return 0

  const remainingMs = expiresAt - Date.now()
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0
}

export function markOtpSent(email: string): void {
  const key = `${STORAGE_PREFIX}${email.trim().toLowerCase()}`
  localStorage.setItem(key, String(Date.now() + COOLDOWN_SECONDS * 1000))
}

export function getPendingAuthEmail(): string | null {
  return sessionStorage.getItem('auth-pending-email')
}

export function setPendingAuthEmail(email: string): void {
  sessionStorage.setItem('auth-pending-email', email.trim().toLowerCase())
}

export function clearPendingAuthEmail(): void {
  sessionStorage.removeItem('auth-pending-email')
}
