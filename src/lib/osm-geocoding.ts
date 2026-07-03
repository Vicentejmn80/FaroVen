export interface ResolvedPlace {
  address: string
  lat: number
  lng: number
  name?: string
  osmId?: string
  mapUrl: string
}

/** Proxy local (dev) y serverless en Vercel — evita bloqueo CSP/CORS en el navegador */
const NOMINATIM = '/api/nominatim'

export function osmMapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

interface NominatimResult {
  place_id?: number
  lat?: string
  lon?: string
  display_name?: string
  name?: string
}

function rowToPlace(row: NominatimResult): ResolvedPlace | null {
  if (!row.display_name || !row.lat || !row.lon) return null
  const lat = Number(row.lat)
  const lng = Number(row.lon)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return {
    address: row.display_name,
    lat,
    lng,
    name: row.name,
    osmId: row.place_id ? String(row.place_id) : undefined,
    mapUrl: osmMapUrl(lat, lng),
  }
}

async function nominatimFetch(path: string, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${NOMINATIM}${path}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'es',
    },
  })
  return res
}

function assertJsonResponse(res: Response): void {
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    throw new Error('Geocoding proxy unavailable')
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<ResolvedPlace[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '8',
    countrycodes: 've',
  })

  const res = await nominatimFetch(`/search?${params}`, signal)
  assertJsonResponse(res)
  if (!res.ok) throw new Error('No se pudo buscar. Toca el mapa para marcar el sitio.')
  const data = (await res.json()) as NominatimResult[]
  return data.map(rowToPlace).filter((p): p is ResolvedPlace => p !== null)
}

export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedPlace | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
    'accept-language': 'es',
  })

  const res = await nominatimFetch(`/reverse?${params}`)
  assertJsonResponse(res)
  if (!res.ok) return null
  const data = (await res.json()) as NominatimResult
  return rowToPlace(data)
}

export async function geocodeAddress(query: string): Promise<ResolvedPlace | null> {
  const results = await searchPlaces(query)
  return results[0] ?? null
}

export async function resolveCoordinates(lat: number, lng: number): Promise<ResolvedPlace> {
  const reversed = await reverseGeocode(lat, lng)
  if (reversed) return reversed
  return {
    address: `Ubicación marcada (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    lat,
    lng,
    mapUrl: osmMapUrl(lat, lng),
  }
}
