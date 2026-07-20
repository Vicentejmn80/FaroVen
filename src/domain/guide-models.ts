/** Tipos del Centro de Recursos — desacoplados de la UI. */

export type GuideModuleId =
  | 'emergency'
  | 'protocols'
  | 'kit'
  | 'official'
  | 'verified'
  | 'faq'
  | 'status'
  | 'about'
  | 'contact'

export interface GuideModule {
  id: GuideModuleId
  label: string
  description: string
}

export interface EmergencyContact {
  id: string
  name: string
  description: string
  phone: string
  icon: string
  priority: number
}

export interface EmergencyProtocol {
  id: string
  title: string
  icon: string
  summary: string
  bluf: {
    doImmediately: string[]
    doNot: string[]
    additionalTips: string[]
  }
}

export interface EmergencyKitItem {
  id: string
  label: string
  hint?: string
  essential: boolean
}

export interface OfficialResource {
  id: string
  name: string
  description: string
  icon: string
  website?: string
  phones?: string[]
  social?: Array<{ label: string; url: string }>
}

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export interface VerifiedAnnouncement {
  id: string
  title: string
  body: string
  source: string
  verifiedAt: string
  kind: 'operational' | 'alert' | 'info'
}

export interface FaroAboutBlock {
  id: string
  title: string
  body: string
}

export type FeedbackCategory = 'bug' | 'suggestion' | 'incorrect_info'

export interface GuideFeedbackInput {
  category: FeedbackCategory
  message: string
  email?: string
}

export interface FaroTeamContact {
  name: string
  role: string
  phone?: string
  phoneDisplay?: string
  email: string
  emailNote?: string
}

export interface AppStatusSnapshot {
  version: string
  lastDeployLabel: string
  serverStatus: 'online' | 'offline' | 'degraded'
  syncStatus: 'synced' | 'cached' | 'offline'
  offlineMode: boolean
  lastSyncAt: Date | null
}
