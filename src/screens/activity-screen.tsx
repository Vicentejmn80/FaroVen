import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { ResourcesHub } from '@/components/guide/resources-hub'

/** Centro de Recursos — información crítica para emergencias. */
export function ActivityScreen() {
  return (
    <ScreenScaffold title="Centro de Recursos" subtitle="FARO · Protección y preparación">
      <ResourcesHub />
    </ScreenScaffold>
  )
}
