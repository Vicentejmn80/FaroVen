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
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export function defaultMapCenter(): [number, number] {
  return [CARACAS_LAT, CARACAS_LNG]
}

/** Enlace externo al punto en OpenStreetMap (gratuito). */
export function buildMapLink(lat: number, lng: number): string | null {
  if (!isValidCoord(lat, lng)) return null
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

/** Abrir ruta hacia el centro (Google Maps, sin API key). */
export function buildNavigateLink(lat: number, lng: number): string | null {
  if (!isValidCoord(lat, lng)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`
}

export function openExternalNavigation(lat: number, lng: number): boolean {
  const url = buildNavigateLink(lat, lng) ?? buildMapLink(lat, lng)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

/** @deprecated Usa buildMapLink */
export function buildGoogleMapsLink(lat: number, lng: number, _label?: string): string {
  return buildMapLink(lat, lng) ?? ''
}
