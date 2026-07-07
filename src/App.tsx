import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app/AppShell'
import { PushDebugPanel } from '@/components/dev/PushDebugPanel'
import { PwaDiagnosticsPanel } from '@/components/dev/PwaDiagnosticsPanel'
import { HelpCenterSheet } from '@/components/onboarding/HelpCenterSheet'
import { InitialOnboardingFlow } from '@/components/onboarding/InitialOnboardingFlow'
import { LandingPage } from '@/components/onboarding/LandingPage'
import { PwaUpdateBanner } from '@/components/pwa/PwaUpdateBanner'
import { useOnboardingGate } from '@/hooks/useOnboardingGate'

export default function App() {
  const { showLanding, showInitialOnboarding, enterApp, completeInitialOnboarding } = useOnboardingGate()
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const openHelp = () => setHelpOpen(true)
    window.addEventListener('faro:open-help-center', openHelp)
    return () => window.removeEventListener('faro:open-help-center', openHelp)
  }, [])

  if (showLanding) {
    return <LandingPage onEnter={enterApp} />
  }

  return (
    <>
      <AppShell />
      <PwaUpdateBanner />
      <PushDebugPanel />
      <PwaDiagnosticsPanel />
      <InitialOnboardingFlow open={showInitialOnboarding} onComplete={completeInitialOnboarding} />
      <HelpCenterSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
