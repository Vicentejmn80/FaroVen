export const ONBOARDING_STORAGE_KEY = 'faro_onboarding_completed'
export const CONTEXTUAL_HELP_KEY = 'faro_contextual_help_seen'
/** Onboarding breve post-registro (antes de selección de rol). */
export const REGISTRATION_ONBOARDING_KEY = 'faro_registration_onboarding'

export type OnboardingModuleId =
  | 'map'
  | 'activity'
  | 'reports'
  | 'profile'
  | 'ops'
  | 'admin'
  | 'system'

function readContextualSeen(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CONTEXTUAL_HELP_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeContextualSeen(map: Record<string, boolean>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONTEXTUAL_HELP_KEY, JSON.stringify(map))
}

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
}

export function markOnboardingCompleted(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
}

export function hasSeenContextualHelp(moduleId: OnboardingModuleId): boolean {
  return Boolean(readContextualSeen()[moduleId])
}

export function markContextualHelpSeen(moduleId: OnboardingModuleId): void {
  const seen = readContextualSeen()
  seen[moduleId] = true
  writeContextualSeen(seen)
}

function registrationOnboardingKey(userId: string): string {
  return `${REGISTRATION_ONBOARDING_KEY}:${userId}`
}

export function hasCompletedRegistrationOnboarding(userId: string | null | undefined): boolean {
  if (typeof window === 'undefined' || !userId) return true
  return window.localStorage.getItem(registrationOnboardingKey(userId)) === 'true'
}

export function markRegistrationOnboardingCompleted(userId: string | null | undefined): void {
  if (typeof window === 'undefined' || !userId) return
  window.localStorage.setItem(registrationOnboardingKey(userId), 'true')
}

/** Reinicia onboarding inicial y tarjetas contextuales. */
export function resetAllOnboarding(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  window.localStorage.removeItem(CONTEXTUAL_HELP_KEY)
  const prefix = `${REGISTRATION_ONBOARDING_KEY}:`
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(prefix)) window.localStorage.removeItem(key)
  }
}
