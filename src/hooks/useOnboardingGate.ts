import { useCallback, useMemo, useState } from 'react'
import { hasCompletedOnboarding, markOnboardingCompleted } from '@/lib/onboarding-storage'

export function useOnboardingGate() {
  const [completed] = useState(() => hasCompletedOnboarding())
  const [showLanding, setShowLanding] = useState(!completed)
  const [showWelcome, setShowWelcome] = useState(false)

  const enterApp = useCallback(() => {
    setShowLanding(false)
    if (!hasCompletedOnboarding()) {
      setShowWelcome(true)
    }
  }, [])

  const completeWelcome = useCallback(() => {
    markOnboardingCompleted()
    setShowWelcome(false)
  }, [])

  return useMemo(
    () => ({
      showLanding,
      showWelcome,
      enterApp,
      completeWelcome,
    }),
    [showLanding, showWelcome, enterApp, completeWelcome],
  )
}
