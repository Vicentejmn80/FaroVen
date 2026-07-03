import type { GuideModule } from '@/domain/guide-models'

export { EMERGENCY_CONTACTS } from './emergency-contacts'
export { EMERGENCY_PROTOCOLS } from './protocols'
export { EMERGENCY_KIT_ITEMS } from './emergency-kit'
export { OFFICIAL_RESOURCES } from './official-resources'
export { GUIDE_FAQ } from './faq'
export { FARO_ABOUT_BLOCKS, VERIFIED_SEED_ANNOUNCEMENTS } from './faro-about'
export { FARO_TEAM_CONTACT } from './faro-team-contact'

export const GUIDE_MODULES: GuideModule[] = [
  { id: 'emergency', label: 'Emergencia', description: 'Llamar ahora' },
  { id: 'protocols', label: 'Qué hacer', description: 'Protocolos BLUF' },
  { id: 'kit', label: 'Mochila', description: 'Checklist' },
  { id: 'official', label: 'Oficiales', description: 'Instituciones' },
  { id: 'verified', label: 'Verificado', description: 'Sin desinformación' },
  { id: 'faq', label: 'FAQ', description: 'Preguntas' },
  { id: 'status', label: 'Estado', description: 'App y sync' },
  { id: 'about', label: 'FARO', description: 'Cómo funciona' },
  { id: 'contact', label: 'Contacto', description: 'Escríbenos' },
]

export const APP_VERSION = '1.0.0'
