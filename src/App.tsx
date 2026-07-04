import { AppShell } from '@/components/app/AppShell'
import { PwaDiagnosticsPanel } from '@/components/dev/PwaDiagnosticsPanel'
import { LandingPage } from '@/components/onboarding/LandingPage'
import { WelcomeSheet } from '@/components/onboarding/WelcomeSheet'
import { PwaUpdateBanner } from '@/components/pwa/PwaUpdateBanner'
import { useOnboardingGate } from '@/hooks/useOnboardingGate'

export default function App() {
  const { showLanding, showWelcome, enterApp, completeWelcome } = useOnboardingGate()

  if (showLanding) {
    return <LandingPage onEnter={enterApp} />
  }

  return (
    <>
      <AppShell />
      <PwaUpdateBanner />
      <PwaDiagnosticsPanel />
      <WelcomeSheet open={showWelcome} onComplete={completeWelcome} />
    </>
  )
}
