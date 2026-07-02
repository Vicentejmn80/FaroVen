import { AppShell } from '@/components/app/AppShell'
import { LandingPage } from '@/components/onboarding/LandingPage'
import { WelcomeSheet } from '@/components/onboarding/WelcomeSheet'
import { useOnboardingGate } from '@/hooks/useOnboardingGate'

export default function App() {
  const { showLanding, showWelcome, enterApp, completeWelcome } = useOnboardingGate()

  if (showLanding) {
    return <LandingPage onEnter={enterApp} />
  }

  return (
    <>
      <AppShell />
      <WelcomeSheet open={showWelcome} onComplete={completeWelcome} />
    </>
  )
}
