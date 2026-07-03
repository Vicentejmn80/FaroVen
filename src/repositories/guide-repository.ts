import {
  APP_VERSION,
  EMERGENCY_CONTACTS,
  EMERGENCY_KIT_ITEMS,
  EMERGENCY_PROTOCOLS,
  FARO_ABOUT_BLOCKS,
  FARO_TEAM_CONTACT,
  GUIDE_FAQ,
  GUIDE_MODULES,
  OFFICIAL_RESOURCES,
  VERIFIED_SEED_ANNOUNCEMENTS,
} from '@/data/guide'
import type {
  AppStatusSnapshot,
  EmergencyContact,
  EmergencyKitItem,
  EmergencyProtocol,
  FaqItem,
  FaroAboutBlock,
  FaroTeamContact,
  GuideFeedbackInput,
  GuideModule,
  OfficialResource,
  VerifiedAnnouncement,
} from '@/domain/guide-models'
import { appendFeedback } from '@/lib/guide-storage'
import { supabase } from '@/lib/supabase'
import { isSupabaseEnabled } from '@/lib/supabase'

export class GuideRepository {
  getModules(): GuideModule[] {
    return GUIDE_MODULES
  }

  getEmergencyContacts(): EmergencyContact[] {
    return [...EMERGENCY_CONTACTS].sort((a, b) => a.priority - b.priority)
  }

  getProtocols(): EmergencyProtocol[] {
    return EMERGENCY_PROTOCOLS
  }

  getProtocolById(id: string): EmergencyProtocol | null {
    return EMERGENCY_PROTOCOLS.find((p) => p.id === id) ?? null
  }

  getKitItems(): EmergencyKitItem[] {
    return EMERGENCY_KIT_ITEMS
  }

  getOfficialResources(): OfficialResource[] {
    return OFFICIAL_RESOURCES
  }

  getOfficialResourceById(id: string): OfficialResource | null {
    return OFFICIAL_RESOURCES.find((r) => r.id === id) ?? null
  }

  getFaq(): FaqItem[] {
    return GUIDE_FAQ
  }

  getAboutBlocks(): FaroAboutBlock[] {
    return FARO_ABOUT_BLOCKS
  }

  getVerifiedSeed(): VerifiedAnnouncement[] {
    return VERIFIED_SEED_ANNOUNCEMENTS
  }

  getAppVersion(): string {
    return APP_VERSION
  }

  getTeamContact(): FaroTeamContact {
    return FARO_TEAM_CONTACT
  }

  async submitFeedback(input: GuideFeedbackInput): Promise<void> {
    const payload = {
      p_category: input.category,
      p_message: input.message.trim(),
      p_email: input.email?.trim() || null,
    }

    const { error } = await supabase.rpc('submit_guide_feedback', payload)
    if (error) {
      appendFeedback({
        category: input.category,
        message: input.message.trim(),
        email: input.email?.trim() || undefined,
      })
      throw error
    }
  }

  buildAppStatus(options: {
    networkOnline: boolean
    cachedAt: Date | null
    loadError: string | null
  }): AppStatusSnapshot {
    const offlineMode = !options.networkOnline
    let serverStatus: AppStatusSnapshot['serverStatus'] = 'online'
    if (!options.networkOnline) serverStatus = 'offline'
    else if (options.loadError) serverStatus = 'degraded'

    let syncStatus: AppStatusSnapshot['syncStatus'] = 'synced'
    if (offlineMode) syncStatus = 'offline'
    else if (options.cachedAt && options.loadError) syncStatus = 'cached'

    return {
      version: APP_VERSION,
      lastDeployLabel: 'Producción',
      serverStatus,
      syncStatus,
      offlineMode,
      lastSyncAt: options.cachedAt,
    }
  }

  isBackendEnabled(): boolean {
    return isSupabaseEnabled
  }
}

export const guideRepository = new GuideRepository()
