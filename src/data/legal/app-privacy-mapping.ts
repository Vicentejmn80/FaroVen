/**
 * Mapeo para Google Play Data Safety y Apple App Privacy.
 * Fuente: Política de Privacidad FARO + stack real (Supabase, OneSignal, Vercel).
 */
export type AppPrivacyCategory =
  | 'contact_info'
  | 'user_content'
  | 'location'
  | 'diagnostics'
  | 'app_activity'
  | 'device_or_other_ids'

export interface AppPrivacyEntry {
  category: AppPrivacyCategory
  data: string[]
  purpose: string
  /** true si el dato se comparte con proveedor (Supabase, OneSignal, Vercel). */
  shared: boolean
  sharedWith?: string[]
  optional?: boolean
  encryptedInTransit?: boolean
}

export const APP_PRIVACY_MAPPING: AppPrivacyEntry[] = [
  {
    category: 'contact_info',
    data: ['Nombre', 'Correo electrónico', 'Teléfono'],
    purpose: 'Cuentas operativas, coordinación humanitaria y contacto con usuarios.',
    shared: true,
    sharedWith: ['Supabase'],
    encryptedInTransit: true,
  },
  {
    category: 'location',
    data: ['Ciudad/estado', 'Coordenadas aproximadas en reportes y centros'],
    purpose: 'Mapeo de necesidades y coordinación en emergencias.',
    shared: true,
    sharedWith: ['Supabase'],
    optional: true,
    encryptedInTransit: true,
  },
  {
    category: 'user_content',
    data: ['Reportes ciudadanos', 'Actualizaciones de centros', 'Mensajes de contacto'],
    purpose: 'Coordinar ayuda y verificar información operativa.',
    shared: true,
    sharedWith: ['Supabase'],
    encryptedInTransit: true,
  },
  {
    category: 'device_or_other_ids',
    data: ['Player ID de OneSignal', 'Tipo de dispositivo'],
    purpose: 'Notificaciones push operativas.',
    shared: true,
    sharedWith: ['OneSignal'],
    optional: true,
    encryptedInTransit: true,
  },
  {
    category: 'app_activity',
    data: ['Preferencias de notificación', 'Registros de sesión'],
    purpose: 'Personalizar alertas y mantener sesión segura.',
    shared: true,
    sharedWith: ['Supabase'],
    encryptedInTransit: true,
  },
  {
    category: 'diagnostics',
    data: ['Logs de autenticación', 'Eventos críticos de la app'],
    purpose: 'Seguridad, auditoría y estabilidad del servicio.',
    shared: true,
    sharedWith: ['Supabase', 'Vercel'],
    encryptedInTransit: true,
  },
]

/** Declaraciones explícitas para formularios de tiendas. */
export const APP_STORE_PRIVACY_DECLARATIONS = {
  collectsData: true,
  dataLinkedToUser: true,
  dataUsedForTracking: false,
  dataSold: false,
  purposes: ['App functionality', 'Developer communications'] as const,
} as const
