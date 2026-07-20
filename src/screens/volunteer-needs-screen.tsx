import { VolunteerDashboard } from '@/components/volunteer/volunteer-dashboard'
import { useAuth } from '@/store/auth-context'
import { useFaro } from '@/store/faro-context'

interface VolunteerNeedsScreenProps {
  onViewMap: () => void
  onOfferHelp: () => void
  onMyCollaborations: () => void
  onOpenSite?: (siteId: string) => void
}

/** Pantalla «Necesidades» del voluntario — dashboard operativo (sin mapa). */
export function VolunteerNeedsScreen({
  onViewMap,
  onOfferHelp,
  onMyCollaborations,
  onOpenSite,
}: VolunteerNeedsScreenProps) {
  const { user, profile } = useAuth()
  const { sites, state } = useFaro()

  const rawName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Voluntario'
  const firstName = rawName.split(/\s+/)[0]

  return (
    <VolunteerDashboard
      firstName={firstName}
      userId={user?.id}
      sites={sites}
      needs={state.needs}
      onViewAllNeeds={onViewMap}
      onOfferHelp={onOfferHelp}
      onMyCollaborations={onMyCollaborations}
      onOpenNeed={(_needId, siteId) => onOpenSite?.(siteId)}
    />
  )
}
