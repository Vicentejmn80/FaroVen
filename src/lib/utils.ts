import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora local. */
export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Tiempo relativo compacto en español: "hace 3 min", "hace 2 h". */
export function timeAgo(date: Date, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - date.getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

const CARACAS_LAT = 10.4806
const CARACAS_LNG = -66.9036

export function parseCoord(value?: number | string | null, fallback?: number): number {
  if (value == null || value === '') return fallback ?? NaN
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  return Number.isFinite(n) ? n : (fallback ?? NaN)
}

export function isValidCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  // (0,0) is a sentinel for "missing GPS" in FARO — never treat as a real point
  if (lat === 0 && lng === 0) return false
  return true
}

export function defaultMapCenter(): [number, number] {
  return [CARACAS_LAT, CARACAS_LNG]
}

/** Enlace para ver el punto en Google Maps (sin iniciar navegación). */
export function buildGoogleMapsViewLink(
  lat: number,
  lng: number,
  label?: string | null,
): string | null {
  if (!isValidCoord(lat, lng)) return null
  const query = label?.trim() ? `${label}@${lat},${lng}` : `${lat},${lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Enlace externo al punto en OpenStreetMap (gratuito). */
export function buildMapLink(lat: number, lng: number): string | null {
  if (!isValidCoord(lat, lng)) return null
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

export type NavigateDestination = {
  lat: number
  lng: number
  /** Nombre del centro — mejora la etiqueta en Google Maps */
  name?: string | null
  /** Dirección textual de respaldo si faltan coordenadas */
  address?: string | null
}

/**
 * Ruta en Google Maps hacia el punto exacto del centro.
 * Usa lat/lng como destino (pin preciso). Si no hay coords válidas, busca por nombre/dirección.
 */
export function buildNavigateLink(
  latOrDest: number | NavigateDestination,
  lng?: number,
  label?: string | null,
): string | null {
  const dest: NavigateDestination =
    typeof latOrDest === 'object'
      ? latOrDest
      : { lat: latOrDest, lng: lng ?? NaN, name: label }

  const lat = parseCoord(dest.lat)
  const lon = parseCoord(dest.lng)

  if (isValidCoord(lat, lon)) {
    // destination=lat,lng fuerza el pin exacto registrado en FARO
    const params = new URLSearchParams({
      api: '1',
      destination: `${lat},${lon}`,
      travelmode: 'driving',
    })
    return `https://www.google.com/maps/dir/?${params.toString()}`
  }

  const textQuery = [dest.name, dest.address].filter(Boolean).join(', ').trim()
  if (!textQuery) return null
  const params = new URLSearchParams({
    api: '1',
    destination: textQuery,
    travelmode: 'driving',
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function openExternalNavigation(
  latOrDest: number | NavigateDestination,
  lng?: number,
  label?: string | null,
): boolean {
  const url =
    typeof latOrDest === 'object'
      ? buildNavigateLink(latOrDest)
      : buildNavigateLink(latOrDest, lng, label)
  const fallback =
    typeof latOrDest === 'object'
      ? buildMapLink(latOrDest.lat, latOrDest.lng)
      : buildMapLink(latOrDest, lng ?? NaN)
  const target = url ?? fallback
  if (!target) return false
  window.open(target, '_blank', 'noopener,noreferrer')
  return true
}

/** @deprecated Usa buildMapLink */
export function buildGoogleMapsLink(lat: number, lng: number, _label?: string): string {
  return buildMapLink(lat, lng) ?? ''
}
