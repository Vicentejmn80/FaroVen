export const APP_NAME = 'FaroVen'
export const APP_SLUG = 'faroven'
export const APP_ICON = '🗼'
export const APP_TAGLINE = 'Tu faro de información verificada en Venezuela'
export const APP_DESCRIPTION =
  'Consulta necesidades, hospitales y centros de acopio con datos verificados por coordinadores en sitio.'
export const SEARCH_MIN_LENGTH = 2
export const SEARCH_DEBOUNCE_MS = 300
export const MAX_SEARCH_RESULTS = 20
export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? ''

export const NAV_ITEMS = [
  { label: 'Buscar Persona', href: '/search', icon: 'search' },
  { label: 'Hospitales', href: '/hospitals', icon: 'hospital' },
  { label: 'Refugios', href: '/shelters', icon: 'shelter' },
  { label: 'Centros de Acopio', href: '/supply-centers', icon: 'package' },
  { label: 'Necesidades', href: '/needs', icon: 'alert' },
  { label: 'Reportar Error', href: '/report', icon: 'flag' },
] as const
