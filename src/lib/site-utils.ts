import type { Site } from '@/lib/types'
import type { RegisterSiteType } from '@/repositories/types'

export function siteToNeedableType(site: Pick<Site, 'type'>): RegisterSiteType {
  if (site.type === 'shelter') return 'shelter'
  if (site.type === 'supply_center') return 'supply_center'
  return 'hospital'
}

export const SITE_TYPE_LABELS: Record<RegisterSiteType, string> = {
  hospital: 'Hospital',
  shelter: 'Refugio',
  supply_center: 'Centro de acopio',
}

export const PRIORITY_OPTIONS = [
  { value: 'critical' as const, label: 'Crítica' },
  { value: 'high' as const, label: 'Alta' },
  { value: 'medium' as const, label: 'Media' },
  { value: 'low' as const, label: 'Baja' },
]

export type GeolocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: string }

export async function readCurrentPosition(): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    return { ok: false, reason: 'Tu navegador no soporta geolocalización.' }
  }

  if (!window.isSecureContext) {
    return { ok: false, reason: 'La ubicación GPS requiere HTTPS o localhost.' }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => {
        const reasons: Record<number, string> = {
          1: 'Permiso de ubicación denegado. Actívalo en la barra del navegador e intenta de nuevo.',
          2: 'No se pudo determinar tu posición. Usa el buscador de dirección.',
          3: 'Tiempo de espera agotado. Intenta de nuevo o busca la dirección manualmente.',
        }
        resolve({ ok: false, reason: reasons[err.code] ?? 'No se pudo obtener tu ubicación.' })
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  })
}
