/**
 * Geo safety — única puerta para coordenadas y operaciones Leaflet.
 * Nunca lanza por datos inválidos: valida, registra warning y omite.
 */
import type { Map as LeafletMap } from 'leaflet'
import { parseCoord, isValidCoord, defaultMapCenter } from '@/lib/utils'

const LOG = '[FARO]'

export type LatLngTuple = [number, number]

export interface GeoPoint {
  lat: number
  lng: number
}

export interface GeoContext {
  entityId?: string
  entityType?: string
  title?: string
  action?: string
}

/** Alias explícitos pedidos por la arquitectura de mapa. */
export const isValidCoordinate = isValidCoord
export const isValidLatLng = isValidCoord

export function toGeoPoint(
  lat: unknown,
  lng: unknown,
  context?: GeoContext,
): GeoPoint | null {
  const parsedLat = parseCoord(lat as number | string | null | undefined)
  const parsedLng = parseCoord(lng as number | string | null | undefined)

  if (!isValidCoord(parsedLat, parsedLng)) {
    if (context) {
      console.warn(`${LOG} Missing / invalid coordinates. Skipping ${context.action ?? 'geo op'}.`, {
        entityId: context.entityId,
        entityType: context.entityType,
        title: context.title,
        lat,
        lng,
      })
    }
    return null
  }

  return { lat: parsedLat, lng: parsedLng }
}

export function toLatLngTuple(
  lat: unknown,
  lng: unknown,
  context?: GeoContext,
): LatLngTuple | null {
  const point = toGeoPoint(lat, lng, context)
  return point ? [point.lat, point.lng] : null
}

export function hasUsableMapSize(map: LeafletMap): boolean {
  try {
    const size = map.getSize()
    return size.x > 0 && size.y > 0
  } catch {
    return false
  }
}

/**
 * flyTo seguro: no opera en mapas ocultos (size 0) ni con coords inválidas.
 * Un mapa con display:none produce NaN internos en Leaflet — esa es la causa raíz del crash.
 */
export function safeFlyTo(
  map: LeafletMap,
  lat: unknown,
  lng: unknown,
  options?: {
    zoom?: number
    duration?: number
    context?: GeoContext
  },
): boolean {
  const position = toLatLngTuple(lat, lng, {
    ...options?.context,
    action: options?.context?.action ?? 'flyTo',
  })
  if (!position) return false

  if (!hasUsableMapSize(map)) {
    console.warn(`${LOG} Map container has zero size. Skipping flyTo().`, {
      entityId: options?.context?.entityId,
      title: options?.context?.title,
    })
    return false
  }

  try {
    const zoom = options?.zoom ?? Math.max(map.getZoom(), 13)
    if (import.meta.env.DEV) {
      console.info(`${LOG} Centering map`, {
        entityId: options?.context?.entityId,
        position,
        zoom,
      })
    }
    map.flyTo(position, zoom, { duration: options?.duration ?? 0.24 })
    return true
  } catch (err) {
    console.warn(`${LOG} flyTo failed (swallowed).`, err)
    return false
  }
}

export function safeSetView(
  map: LeafletMap,
  lat: unknown,
  lng: unknown,
  options?: { zoom?: number; context?: GeoContext },
): boolean {
  const position = toLatLngTuple(lat, lng, {
    ...options?.context,
    action: options?.context?.action ?? 'setView',
  })
  if (!position) return false
  if (!hasUsableMapSize(map)) {
    console.warn(`${LOG} Map container has zero size. Skipping setView().`)
    return false
  }
  try {
    map.setView(position, options?.zoom ?? Math.max(map.getZoom(), 13))
    return true
  } catch (err) {
    console.warn(`${LOG} setView failed (swallowed).`, err)
    return false
  }
}

/** Posición segura para <Marker />; null → no renderizar el marcador. */
export function safeMarkerPosition(
  lat: unknown,
  lng: unknown,
  context?: GeoContext,
): LatLngTuple | null {
  return toLatLngTuple(lat, lng, { ...context, action: context?.action ?? 'marker' })
}

export function safeMapCenter(
  points: Array<{ lat: unknown; lng: unknown }>,
): LatLngTuple {
  const valid: GeoPoint[] = []
  for (const p of points) {
    const point = toGeoPoint(p.lat, p.lng)
    if (point) valid.push(point)
  }
  if (!valid.length) return defaultMapCenter()
  const lat = valid.reduce((acc, p) => acc + p.lat, 0) / valid.length
  const lng = valid.reduce((acc, p) => acc + p.lng, 0) / valid.length
  return isValidCoord(lat, lng) ? [lat, lng] : defaultMapCenter()
}

export { parseCoord, isValidCoord, defaultMapCenter }
