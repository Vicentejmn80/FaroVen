import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { ResourcesHub } from '@/components/guide/resources-hub'

/** Centro de Recursos — información crítica para emergencias. */
export function ActivityScreen() {
  return (
    <ScreenScaffold title="Centro de Recursos" subtitle="FARO · Protección y preparación">
      <ContextualHelpCard moduleId="activity" className="mb-4" />
      <ResourcesHub />
    </ScreenScaffold>
  )
}
