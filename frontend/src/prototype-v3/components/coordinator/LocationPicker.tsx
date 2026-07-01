import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { CARACAS_CENTER } from '@/prototype-v2/lib/geo'
import { getGoogleMapsLink } from '@/lib/utils'

export interface PickedLocation {
  name: string
  address: string
  latitude: number
  longitude: number
  cityZone: string
}

interface NominatimAddress {
  amenity?: string
  shop?: string
  road?: string
  suburb?: string
  city?: string
  town?: string
  state?: string
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  name?: string
  address?: NominatimAddress
}

interface LocationPickerProps {
  confirmed: PickedLocation | null
  onConfirm: (location: PickedLocation) => void
  onClear: () => void
}

function buildLocationFromResult(r: NominatimResult): PickedLocation {
  const name =
    r.name?.trim() ||
    r.address?.amenity?.trim() ||
    r.address?.shop?.trim() ||
    r.display_name.split(',')[0]?.trim() ||
    'Sitio sin nombre'

  const cityZone = [r.address?.suburb, r.address?.city || r.address?.town, r.address?.state]
    .filter(Boolean)
    .join(' · ')

  return {
    name,
    address: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    cityZone: cityZone || r.display_name.split(',').slice(1, 3).join(' · ').trim(),
  }
}

async function searchLocations(query: string): Promise<NominatimResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '6')
  url.searchParams.set('countrycodes', 've')
  url.searchParams.set('q', query)

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('No se pudo consultar ubicaciones')
  return (await res.json()) as NominatimResult[]
}

export function LocationPicker({ confirmed, onConfirm, onClear }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [draft, setDraft] = useState<PickedLocation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  const active = confirmed ?? draft

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: [CARACAS_CENTER.lat, CARACAS_CENTER.lng],
      zoom: 11,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    mapRef.current = map

    return () => {
      markerRef.current?.remove()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !active) return

    const latlng = L.latLng(active.latitude, active.longitude)

    if (!markerRef.current) {
      markerRef.current = L.marker(latlng, { draggable: !confirmed }).addTo(map)
      markerRef.current.on('dragend', () => {
        if (confirmed) return
        const p = markerRef.current?.getLatLng()
        if (!p || !draft) return
        setDraft({
          ...draft,
          latitude: Number(p.lat.toFixed(6)),
          longitude: Number(p.lng.toFixed(6)),
        })
      })
    } else {
      markerRef.current.setLatLng(latlng)
      if (markerRef.current.dragging) {
        confirmed ? markerRef.current.dragging.disable() : markerRef.current.dragging.enable()
      }
    }

    map.setView(latlng, 15)
  }, [active, confirmed, draft])

  const canSearch = useMemo(() => query.trim().length >= 3, [query])

  const handleSearch = async () => {
    setError(null)
    if (!canSearch) return
    setIsLoading(true)
    try {
      const found = await searchLocations(query.trim())
      setResults(found)
      if (!found.length) setError('No encontramos coincidencias. Prueba con otro nombre o referencia.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar')
    } finally {
      setIsLoading(false)
    }
  }

  const pickResult = (r: NominatimResult) => {
    const loc = buildLocationFromResult(r)
    setDraft(loc)
    setQuery(loc.name)
    setResults([])
    setError(null)
  }

  const handleConfirm = () => {
    if (!draft) return
    onConfirm(draft)
    setDraft(null)
    setQuery('')
    setResults([])
  }

  const handleClear = () => {
    setDraft(null)
    setQuery('')
    setResults([])
    setError(null)
    markerRef.current?.remove()
    markerRef.current = null
    onClear()
  }

  return (
    <div className="pv3-location-picker">
      {!confirmed && (
        <>
          <label className="pv3-label">Busca tu sitio en el mapa</label>
          <div className="pv3-location-row">
            <input
              className="pv3-input"
              placeholder='Ej. "La gandola", hospital, acopio…'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
            />
            <button type="button" className="pv3-btn" onClick={handleSearch} disabled={isLoading || !canSearch}>
              {isLoading ? '…' : 'Buscar'}
            </button>
          </div>
          <p className="pv3-location-hint">
            Elige una opción, ajusta el pin si hace falta y confirma. La dirección se autocompleta.
          </p>

          {results.length > 0 && (
            <div className="pv3-location-results">
              {results.map((r) => (
                <button key={r.place_id} type="button" className="pv3-location-result" onClick={() => pickResult(r)}>
                  {r.display_name}
                </button>
              ))}
            </div>
          )}

          {error && <p className="pv3-location-error">{error}</p>}
        </>
      )}

      <div ref={mapContainerRef} className="pv3-location-map" />

      {draft && !confirmed && (
        <div className="pv3-location-draft">
          <p className="pv3-location-draft__name">{draft.name}</p>
          <p className="pv3-location-draft__addr">{draft.address}</p>
          <div className="pv3-location-actions">
            <button type="button" className="pv3-btn pv3-btn--primary" onClick={handleConfirm}>
              Confirmar ubicación
            </button>
            <a
              className="pv3-btn"
              href={getGoogleMapsLink({
                name: draft.name,
                address: draft.address,
                latitude: draft.latitude,
                longitude: draft.longitude,
              })}
              target="_blank"
              rel="noreferrer"
            >
              Ver en Maps
            </a>
          </div>
        </div>
      )}

      {confirmed && (
        <div className="pv3-location-confirmed">
          <p className="pv3-location-confirmed__label">Ubicación confirmada</p>
          <p className="pv3-location-draft__name">{confirmed.name}</p>
          <p className="pv3-location-draft__addr">{confirmed.address}</p>
          <div className="pv3-location-actions">
            <a
              className="pv3-btn"
              href={getGoogleMapsLink({
                name: confirmed.name,
                address: confirmed.address,
                latitude: confirmed.latitude,
                longitude: confirmed.longitude,
              })}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en Google Maps
            </a>
            <button type="button" className="pv3-btn" onClick={handleClear}>
              Cambiar ubicación
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
