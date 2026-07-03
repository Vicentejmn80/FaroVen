import type { Event } from '@/domain/models'
import type { GuideFeedbackInput, VerifiedAnnouncement } from '@/domain/guide-models'
import { guideRepository } from '@/repositories/guide-repository'

function eventToVerified(event: Event): VerifiedAnnouncement | null {
  if (event.status !== 'operational' && event.status !== 'critical' && event.status !== 'warning') {
    return null
  }
  const kind =
    event.status === 'critical' ? 'alert' : event.status === 'warning' ? 'alert' : 'operational'
  return {
    id: `event-${event.id}`,
    title: event.title,
    body: event.detail,
    source: 'Coordinación FARO',
    verifiedAt: event.createdAt.toISOString(),
    kind,
  }
}

export const guideService = {
  getModules: () => guideRepository.getModules(),
  getEmergencyContacts: () => guideRepository.getEmergencyContacts(),
  getProtocols: () => guideRepository.getProtocols(),
  getProtocolById: (id: string) => guideRepository.getProtocolById(id),
  getKitItems: () => guideRepository.getKitItems(),
  getOfficialResources: () => guideRepository.getOfficialResources(),
  getOfficialResourceById: (id: string) => guideRepository.getOfficialResourceById(id),
  getFaq: () => guideRepository.getFaq(),
  getAboutBlocks: () => guideRepository.getAboutBlocks(),
  getTeamContact: () => guideRepository.getTeamContact(),
  getAppStatus: guideRepository.buildAppStatus.bind(guideRepository),
  submitFeedback: (input: GuideFeedbackInput) => guideRepository.submitFeedback(input),

  getVerifiedAnnouncements(liveEvents: Event[]): VerifiedAnnouncement[] {
    const fromEvents = liveEvents
      .slice(0, 12)
      .map(eventToVerified)
      .filter((item): item is VerifiedAnnouncement => item !== null)

    const seeds = guideRepository.getVerifiedSeed()
    const merged = [...fromEvents, ...seeds]
    const seen = new Set<string>()
    return merged.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  },
}
