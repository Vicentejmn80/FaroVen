import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasCompletedOnboarding, markOnboardingCompleted } from '@/lib/onboarding-storage'

export function useOnboardingGate() {
  const [completed] = useState(() => hasCompletedOnboarding())
  const [showLanding, setShowLanding] = useState(!completed)
  const [showInitialOnboarding, setShowInitialOnboarding] = useState(false)

  const enterApp = useCallback(() => {
    setShowLanding(false)
    if (!hasCompletedOnboarding()) {
      setShowInitialOnboarding(true)
    }
  }, [])

  const completeInitialOnboarding = useCallback(() => {
    markOnboardingCompleted()
    setShowInitialOnboarding(false)
  }, [])

  // Permite reabrir la introducción desde Perfil
  useEffect(() => {
    const openIntro = () => setShowInitialOnboarding(true)
    window.addEventListener('faro:open-onboarding', openIntro)
    return () => window.removeEventListener('faro:open-onboarding', openIntro)
  }, [])

  return useMemo(
    () => ({
      showLanding,
      showInitialOnboarding,
      enterApp,
      completeInitialOnboarding,
    }),
    [showLanding, showInitialOnboarding, enterApp, completeInitialOnboarding],
  )
}
