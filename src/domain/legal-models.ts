export type LegalDocumentId = 'terms' | 'privacy' | 'notice' | 'about' | 'contact' | 'cookies'

export interface LegalSection {
  id: string
  title: string
  body: string
  bullets?: string[]
  emphasis?: 'warning' | 'info'
}

export interface LegalDocumentMeta {
  version: string
  updatedAt: string
  effectiveAt: string
}

export interface LegalDocument {
  id: LegalDocumentId
  title: string
  subtitle?: string
  version: string
  updatedAt: string
  effectiveAt: string
  sections: LegalSection[]
}
