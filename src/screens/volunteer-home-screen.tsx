import { VolunteerNeedsScreen } from '@/screens/volunteer-needs-screen'

/** @deprecated Usar VolunteerNeedsScreen */
export function VolunteerHomeScreen({
  onViewAllNeeds,
  onOfferHelp,
  onMyCollaborations,
  onOpenSite,
}: {
  onViewAllNeeds: () => void
  onOfferHelp: () => void
  onMyCollaborations: () => void
  onOpenSite?: (siteId: string) => void
}) {
  return (
    <VolunteerNeedsScreen
      onViewMap={onViewAllNeeds}
      onOfferHelp={onOfferHelp}
      onMyCollaborations={onMyCollaborations}
      onOpenSite={onOpenSite}
    />
  )
}
