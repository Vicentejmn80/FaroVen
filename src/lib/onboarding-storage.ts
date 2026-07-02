export const ONBOARDING_STORAGE_KEY = 'faro_onboarding_completed'

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
}

export function markOnboardingCompleted(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
}
