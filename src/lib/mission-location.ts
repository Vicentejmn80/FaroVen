import type { GeoCoordinates } from '@/domain/models'
import { isValidCoord, parseCoord } from '@/lib/utils'

const OMIT_LOG = '[FARO Mapa Voluntario] Misión omitida por falta de coordenadas'

export interface MissionLocationContext {
  missionId?: string
  needId?: string
  title?: string
}

/**
 * Normaliza lat/lng a números finitos. Devuelve null si no son válidos para Leaflet.
 */
export function resolveMissionCoordinates(
  lat: unknown,
  lng: unknown,
  context?: MissionLocationContext,
): GeoCoordinates | null {
  const parsedLat = parseCoord(lat as number | string | null | undefined)
  const parsedLng = parseCoord(lng as number | string | null | undefined)

  if (!isValidCoord(parsedLat, parsedLng)) {
    if (context && (context.missionId || context.needId || context.title)) {
      console.warn(OMIT_LOG, {
        missionId: context.missionId,
        needId: context.needId,
        title: context.title,
        lat,
        lng,
      })
    }
    return null
  }

  return { lat: parsedLat, lng: parsedLng }
}

export function missionHasMapLocation(mission: {
  location?: { lat?: unknown; lng?: unknown } | null
}): boolean {
  if (!mission.location) return false
  return resolveMissionCoordinates(mission.location.lat, mission.location.lng) !== null
}

/** Tupla [lat, lng] segura para Leaflet, o null si no se puede posicionar. */
export function getMissionLatLng(mission: {
  id?: string
  title?: string
  location?: { lat?: unknown; lng?: unknown } | null
}): [number, number] | null {
  const coords = resolveMissionCoordinates(mission.location?.lat, mission.location?.lng, {
    missionId: mission.id,
    title: mission.title,
  })
  if (!coords) return null
  return [coords.lat, coords.lng]
}

/** Filtra misiones mapeables; registra en consola las omitidas. */
export function filterMappableMissions<T extends { id: string; title?: string; location?: { lat?: unknown; lng?: unknown } | null }>(
  missions: T[],
): T[] {
  return missions.filter((mission) => {
    if (missionHasMapLocation(mission)) return true
    console.warn(OMIT_LOG, { missionId: mission.id, title: mission.title })
    return false
  })
}
