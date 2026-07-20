import type { OperationalStatus, Site } from '@/lib/types'

/** Categorías de acceso rápido del portal público. */
export type PortalCategoryId =
  | 'all'
  | 'hospital'
  | 'shelter'
  | 'supply_center'
  | 'soup_kitchen'
  | 'organization'

export interface PortalCategory {
  id: PortalCategoryId
  label: string
  emoji: string
  /** Tipos Site que coinciden (null = filtro especial / futuro). */
  siteTypes: Array<Site['type']> | null
}

export const PORTAL_CATEGORIES: PortalCategory[] = [
  { id: 'hospital', label: 'Hospitales', emoji: '🏥', siteTypes: ['hospital', 'medical_center'] },
  { id: 'shelter', label: 'Refugios', emoji: '🏠', siteTypes: ['shelter'] },
  { id: 'supply_center', label: 'Acopios', emoji: '📦', siteTypes: ['supply_center'] },
  { id: 'soup_kitchen', label: 'Comedores', emoji: '🍲', siteTypes: null },
  { id: 'organization', label: 'Organiz.', emoji: '🤝', siteTypes: ['organization'] },
]

export interface PortalResourceLink {
  id: string
  title: string
  description: string
  emoji: string
  /** Acción: abrir guía, tel, o evento custom. */
  action: 'first-aid' | 'emergency-numbers' | 'offer-help' | 'shelter-kit'
}

export const PORTAL_RESOURCES: PortalResourceLink[] = [
  {
    id: 'first-aid',
    title: 'Primeros auxilios',
    description: 'Guía rápida para situaciones comunes',
    emoji: '🩹',
    action: 'first-aid',
  },
  {
    id: 'emergency-numbers',
    title: 'Números de emergencia',
    description: '911, ambulancias, bomberos y más',
    emoji: '☎️',
    action: 'emergency-numbers',
  },
  {
    id: 'offer-help',
    title: 'Cómo ofrecer ayuda',
    description: 'Qué puedes hacer si quieres apoyar',
    emoji: '🤲',
    action: 'offer-help',
  },
  {
    id: 'shelter-kit',
    title: 'Qué llevar a un refugio',
    description: 'Lista útil de elementos básicos',
    emoji: '🎒',
    action: 'shelter-kit',
  },
]

function demoSite(
  partial: Pick<Site, 'id' | 'name' | 'type' | 'status' | 'zone' | 'lat' | 'lng'>,
): Site {
  return {
    ...partial,
    statusLabel: partial.status === 'operational' ? 'Abierto' : partial.status === 'critical' ? 'Saturado' : 'Atención',
    mapX: 0,
    mapY: 0,
    needs: [],
    updatedAt: new Date(),
    verified: true,
  }
}

/** Pines de ejemplo cuando aún no hay centros en la base. Caracas / La Guaira. */
export const PORTAL_DEMO_SITES: Site[] = [
  demoSite({
    id: 'demo-hospital-Vargas',
    name: 'Hospital Vargas',
    type: 'hospital',
    status: 'operational' as OperationalStatus,
    zone: 'La Candelaria',
    lat: 10.5055,
    lng: -66.9145,
  }),
  demoSite({
    id: 'demo-shelter-macuto',
    name: 'Refugio Macuto',
    type: 'shelter',
    status: 'warning' as OperationalStatus,
    zone: 'Macuto, La Guaira',
    lat: 10.6175,
    lng: -66.7962,
  }),
  demoSite({
    id: 'demo-acopio-esperanza',
    name: 'Centro Esperanza',
    type: 'supply_center',
    status: 'critical' as OperationalStatus,
    zone: 'Catia',
    lat: 10.5088,
    lng: -66.9472,
  }),
  demoSite({
    id: 'demo-hospital-udm',
    name: 'Hospital Universitario',
    type: 'hospital',
    status: 'warning' as OperationalStatus,
    zone: 'San José',
    lat: 10.492,
    lng: -66.891,
  }),
]

export const PORTAL_DEMO_NEEDS: Record<string, string[]> = {
  'demo-hospital-Vargas': ['Plasma', 'Suero', 'Gasas'],
  'demo-shelter-macuto': ['Colchonetas', 'Agua', 'Leche infantil'],
  'demo-acopio-esperanza': ['Agua', 'Medicamentos', 'Leche infantil'],
  'demo-hospital-udm': ['Plasma', 'Oxígeno'],
}

export type PublicPortalTab = 'home' | 'map' | 'resources' | 'report' | 'guide'

export type CitizenTab = PublicPortalTab
