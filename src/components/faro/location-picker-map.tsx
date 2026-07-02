import { useCallback, useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { LocateFixed, MapPin } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { createPickerMarkerIcon } from '@/components/faro/map-marker'
import { fieldClassName } from '@/components/faro/flow-sheet'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { resolveCoordinates, searchPlaces, type ResolvedPlace } from '@/lib/osm-geocoding'
import { readCurrentPosition } from '@/lib/site-utils'
import { cn } from '@/lib/utils'

const CARACAS: [number, number] = [10.4806, -66.9036]

interface LocationPickerMapProps {
  value: ResolvedPlace | null
  onChange: (place: ResolvedPlace | null) => void
  onNameHint?: (name: string) => void
  className?: string
}

/** Mapa Leaflet + búsqueda + clic para confirmar ubicación (mismo estilo que el mapa principal). */
export function LocationPickerMap({ value, onChange, onNameHint, className }: LocationPickerMapProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResolvedPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(
    value ? [value.lat, value.lng] : null,
  )

  const position = value ? ([value.lat, value.lng] as [number, number]) : null

  const applyPlace = useCallback(
    (place: ResolvedPlace) => {
      onChange(place)
      setFlyTarget([place.lat, place.lng])
      if (place.name) onNameHint?.(place.name)
    },
    [onChange, onNameHint],
  )

  const setFromCoords = useCallback(
    async (lat: number, lng: number) => {
      const place = await resolveCoordinates(lat, lng)
      applyPlace(place)
    },
    [applyPlace],
  )

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearchError(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const found = await searchPlaces(q, controller.signal)
        setResults(found)
        if (!found.length) setSearchError('Sin resultados. Toca el mapa para marcar el punto.')
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setResults([])
        setSearchError('Búsqueda no disponible. Toca el mapa para marcar el sitio.')
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const handleGps = async () => {
    setLocating(true)
    setSearchError(null)
    const pos = await readCurrentPosition()
    if (!pos.ok) {
      setSearchError(pos.reason)
      setLocating(false)
      return
    }
    await setFromCoords(pos.lat, pos.lng)
    setLocating(false)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <FaroIcon size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          className={cn(fieldClassName, 'pl-9')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar barrio, calle o lugar en Venezuela…"
          autoComplete="off"
        />
      </div>

      {searching && <p className="text-xs text-ink-subtle">Buscando…</p>}
      {searchError && !searching && <p className="text-xs text-warning">{searchError}</p>}

      {results.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
          {results.map((place) => (
            <li key={`${place.osmId ?? place.lat}-${place.address}`}>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-info/15"
                onClick={() => {
                  applyPlace(place)
                  setQuery(place.name ?? place.address.split(',')[0] ?? '')
                  setResults([])
                }}
              >
                {place.name && <span className="block text-sm font-medium text-ink">{place.name}</span>}
                <span className="block text-xs leading-snug text-ink-muted">{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative h-[260px] overflow-hidden rounded-3xl ring-1 ring-inset ring-white/10 sm:h-[300px]">
        <MapContainer
          className="faro-map h-full w-full"
          center={position ?? CARACAS}
          zoom={position ? 15 : 12}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="faro-map-tiles" />
          <MapClickHandler onPick={setFromCoords} />
          {flyTarget && <FlyTo target={flyTarget} />}
          {position && (
            <Marker
              position={position}
              icon={createPickerMarkerIcon()}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const p = e.target.getLatLng()
                  void setFromCoords(p.lat, p.lng)
                },
              }}
            />
          )}
        </MapContainer>

        <EmergencyButton
          variant="glass"
          size="sm"
          type="button"
          className="absolute right-3 top-3 z-[500] h-10 gap-1.5 rounded-full px-3 text-xs"
          onClick={handleGps}
          disabled={locating}
        >
          <LocateFixed className={cn('h-3.5 w-3.5', locating && 'animate-pulse')} />
          {locating ? 'GPS…' : 'Mi zona'}
        </EmergencyButton>

        {!position && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] flex justify-center px-3">
            <span className="rounded-full bg-base-900/80 px-3 py-1.5 text-xs text-ink-muted backdrop-blur-sm">
              Toca el mapa para colocar el pin
            </span>
          </div>
        )}
      </div>

      {value ? (
        <div className="rounded-2xl border border-operational/30 bg-operational/10 p-3 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-operational">
            <MapPin className="h-3.5 w-3.5" />
            Ubicación confirmada
          </p>
          <p className="text-sm text-ink">{value.address}</p>
          <p className="text-xs text-ink-muted">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-subtle">Busca un lugar, usa GPS o toca el mapa para confirmar dónde quedará el sitio.</p>
      )}
    </div>
  )
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FlyTo({ target }: { target: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.35 })
  }, [map, target])
  return null
}
