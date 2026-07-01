// Coordenadas de referencia de puntos reales conocidos en Caracas.
// Se usan SOLO cuando un sitio no trae latitud/longitud propias en la base
// de datos, para poder ubicarlo en el mapa. No se inventan datos del sitio:
// nombre, necesidades y estado siempre provienen de la base real.

export interface LatLng {
  lat: number
  lng: number
}

export const CARACAS_CENTER: LatLng = { lat: 10.4806, lng: -66.9036 }

interface KnownPlace extends LatLng {
  keywords: string[]
}

const KNOWN_PLACES: KnownPlace[] = [
  { keywords: ['universitario'], lat: 10.4978, lng: -66.8911 },
  { keywords: ['perez', 'carreno'], lat: 10.4861, lng: -66.9436 },
  { keywords: ['carreno'], lat: 10.4861, lng: -66.9436 },
  { keywords: ['luciani'], lat: 10.4767, lng: -66.8004 },
  { keywords: ['vargas'], lat: 10.5079, lng: -66.9166 },
  { keywords: ['militar'], lat: 10.4936, lng: -66.9214 },
  { keywords: ['concepcion', 'palacios'], lat: 10.4969, lng: -66.9286 },
  { keywords: ['rios'], lat: 10.5009, lng: -66.9075 },
  { keywords: ['parque', 'este'], lat: 10.4986, lng: -66.8430 },
  { keywords: ['poliedro'], lat: 10.4419, lng: -66.9575 },
  { keywords: ['metropolitana'], lat: 10.5012, lng: -66.8965 },
  { keywords: ['plaza', 'venezuela'], lat: 10.4906, lng: -66.8915 },
  { keywords: ['chacao'], lat: 10.4975, lng: -66.8537 },
  { keywords: ['petare'], lat: 10.4869, lng: -66.8136 },
  { keywords: ['catia'], lat: 10.5167, lng: -66.9436 },
  { keywords: ['baruta'], lat: 10.4339, lng: -66.8758 },
  { keywords: ['sucre'], lat: 10.4860, lng: -66.8200 },
]

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isValidCoord = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v !== 0

export interface ResolvedLocation {
  coords: LatLng | null
  /** true cuando la coordenada proviene de una referencia conocida y no del registro. */
  referential: boolean
}

export function resolveLocation(
  name: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): ResolvedLocation {
  if (isValidCoord(latitude) && isValidCoord(longitude)) {
    return { coords: { lat: latitude, lng: longitude }, referential: false }
  }

  const haystack = normalize(name)
  for (const place of KNOWN_PLACES) {
    const matches = place.keywords.every((kw) => haystack.includes(kw))
    if (matches) {
      return { coords: { lat: place.lat, lng: place.lng }, referential: true }
    }
  }

  return { coords: null, referential: false }
}
