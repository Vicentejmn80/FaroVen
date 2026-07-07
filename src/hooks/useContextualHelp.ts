import { useCallback, useState } from 'react'
import {
  hasSeenContextualHelp,
  markContextualHelpSeen,
  type OnboardingModuleId,
} from '@/lib/onboarding-storage'

export function useContextualHelp(moduleId: OnboardingModuleId) {
  const [visible, setVisible] = useState(() => !hasSeenContextualHelp(moduleId))

  const dismiss = useCallback(() => {
    markContextualHelpSeen(moduleId)
    setVisible(false)
  }, [moduleId])

  return { visible, dismiss }
}
