/**
 * Metadatos legales de FARO — fuente única para documentos, contacto y stores.
 * Los correos @faro.org son el canal oficial público (pueden redirigir internamente).
 */
export const FARO_LEGAL_META = {
  projectName: 'FARO',
  teamName: 'Equipo FARO',
  platformUrl: 'https://faro-ven.vercel.app',
  founderName: 'Vicente Maduro',
  founderRole: 'Coordinador General',
  /** Responsable del tratamiento — la plataforma como proyecto, no persona física recurrente. */
  dataController: 'el Equipo FARO',
  /** Descripción institucional (evita encasillar solo como “sin fines de lucro”). */
  projectNature: 'iniciativa tecnológica humanitaria de impacto social',
  city: 'Caracas',
  state: 'Distrito Capital',
  country: 'Venezuela',
  locationLabel: 'Caracas, Distrito Capital, Venezuela',
  emails: {
    contact: 'contacto@faro.org',
    support: 'soporte@faro.org',
    privacy: 'privacidad@faro.org',
    legal: 'legal@faro.org',
  },
  privacyResponseDays: 15,
} as const

export type ContactEmailKind = 'contact' | 'support' | 'privacy' | 'legal'

/** Correo institucional según tipo de consulta. */
export function activeContactEmail(kind: ContactEmailKind): string {
  return FARO_LEGAL_META.emails[kind]
}

/** Línea de contacto para documentos legales. */
export function legalEmailLine(kind: ContactEmailKind, label: string): string {
  return `${label}: ${activeContactEmail(kind)}`
}
