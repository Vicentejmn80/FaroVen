import type { GeoCoordinates } from '@/domain/models'
import { toGeoPoint, toLatLngTuple, type GeoContext } from '@/lib/geo'

const OMIT_LOG_CONTEXT = { entityType: 'mission' as const }

export interface MissionLocationContext {
  missionId?: string
  needId?: string
  title?: string
}

function toContext(context?: MissionLocationContext, action?: string): GeoContext {
  return {
    entityId: context?.missionId ?? context?.needId,
    entityType: 'mission',
    title: context?.title,
    action,
  }
}

/**
 * Normaliza lat/lng a números finitos. Devuelve null si no son válidos para Leaflet.
 */
export function resolveMissionCoordinates(
  lat: unknown,
  lng: unknown,
  context?: MissionLocationContext,
): GeoCoordinates | null {
  return toGeoPoint(lat, lng, toContext(context, 'resolveMissionCoordinates'))
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
  return toLatLngTuple(mission.location?.lat, mission.location?.lng, {
    ...OMIT_LOG_CONTEXT,
    entityId: mission.id,
    title: mission.title,
    action: 'getMissionLatLng',
  })
}

/** Filtra misiones mapeables; registra en consola las omitidas. */
export function filterMappableMissions<
  T extends { id: string; title?: string; location?: { lat?: unknown; lng?: unknown } | null },
>(missions: T[]): T[] {
  return missions.filter((mission) => {
    if (missionHasMapLocation(mission)) return true
    console.warn('[FARO] Mission omitted from map — missing latitude/longitude.', {
      missionId: mission.id,
      title: mission.title,
    })
    return false
  })
}
