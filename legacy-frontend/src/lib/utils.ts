import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'hace unos segundos'
  if (diffMin < 60) return `hace ${diffMin} min`

  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `hace ${diffHrs}h`

  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) return `hace ${diffDays}d`

  return formatDate(dateStr)
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '...'
}

export type FreshnessLevel = 'fresh' | 'stale' | 'expired'

export function getFreshnessLevel(dateStr: string): FreshnessLevel {
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3_600_000
  if (hours < 12) return 'fresh'
  if (hours < 24) return 'stale'
  return 'expired'
}

export const FRESHNESS_LABELS: Record<FreshnessLevel, string> = {
  fresh: 'Actualizado',
  stale: 'Verificar antes de ir',
  expired: 'Probablemente desactualizado',
}

export function getShareUrl(path = '/'): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

interface GoogleMapsLocation {
  name?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

function buildLocationQuery(location: GoogleMapsLocation): string {
  if (
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude)
  ) {
    return `${location.latitude},${location.longitude}`
  }

  return [location.name, location.address]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(', ')
}

export function getGoogleMapsLink(location: GoogleMapsLocation): string | null {
  const query = buildLocationQuery(location)
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function getGoogleMapsEmbedLink(location: GoogleMapsLocation): string | null {
  const query = buildLocationQuery(location)
  if (!query) return null
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}
