import { useEffect, useMemo, useState } from 'react'
import { latLngBounds } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { motion } from 'framer-motion'
import { LocateFixed, Navigation } from 'lucide-react'
import { createSiteMarkerIcon } from './map-marker'
import { cn, defaultMapCenter, isValidCoord } from '@/lib/utils'
import type { Site } from '@/lib/types'

interface MapCanvasProps {
  sites: Site[]
  activeId?: string | null
  onSelect?: (site: Site) => void
  className?: string
}

function sitesWithCoords(sites: Site[]): Site[] {
  return sites.filter((s) => isValidCoord(s.lat, s.lng))
}

/**
 * MapCanvas — implementación con React Leaflet + OpenStreetMap.
 * Mantiene API estable (`sites`, `activeId`, `onSelect`) para poder
 * cambiar proveedor (Mapbox/Google) sin tocar el resto de la app.
 */
export function MapCanvas({ sites, activeId, onSelect, className }: MapCanvasProps) {
  const mappableSites = useMemo(() => sitesWithCoords(sites), [sites])

  const center: [number, number] = useMemo(() => {
    if (!mappableSites.length) return defaultMapCenter()
    const lat = mappableSites.reduce((acc, s) => acc + s.lat, 0) / mappableSites.length
    const lng = mappableSites.reduce((acc, s) => acc + s.lng, 0) / mappableSites.length
    return isValidCoord(lat, lng) ? [lat, lng] : defaultMapCenter()
  }, [mappableSites])

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <MapContainer
        className="faro-map h-full w-full"
        center={center}
        zoom={12}
        zoomControl={false}
        attributionControl={false}
        preferCanvas
      >
        <TileLayer
          className="faro-map-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToSites sites={mappableSites} />
        <FocusActiveSite sites={mappableSites} activeId={activeId} />
        {mappableSites.map((site) => (
          <Marker
            key={site.id}
            position={[site.lat, site.lng]}
            icon={createSiteMarkerIcon(site, activeId === site.id, !!activeId && activeId !== site.id)}
            zIndexOffset={activeId === site.id ? 1200 : 0}
            eventHandlers={{ click: () => onSelect?.(site) }}
          />
        ))}
        <LocateMeControl />
      </MapContainer>

      <motion.div
        initial={false}
        animate={{ opacity: activeId ? 0.2 : 0 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        className="pointer-events-none absolute inset-0 bg-black"
      />

      {/* Viñeta y sheen para una lectura más calmada al estilo Apple Maps */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_30%,transparent_55%,rgba(11,17,32,0.55)_100%)]" />
      <motion.div
        initial={{ opacity: 0.45 }}
        animate={{ opacity: 0.25 }}
        transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_45%)]"
      />
    </div>
  )
}

function FitToSites({ sites }: { sites: Site[] }) {
  const map = useMap()

  useEffect(() => {
    if (!sites.length) return
    const bounds = latLngBounds(sites.map((s) => [s.lat, s.lng] as [number, number]))
    if (!bounds.isValid()) return
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 })
  }, [map, sites])

  return null
}

function FocusActiveSite({ sites, activeId }: { sites: Site[]; activeId?: string | null }) {
  const map = useMap()

  useEffect(() => {
    if (!activeId) return
    const site = sites.find((s) => s.id === activeId)
    if (!site || !isValidCoord(site.lat, site.lng)) return

    const size = map.getSize()
    if (size.x <= 0 || size.y <= 0) return

    const targetZoom = Math.max(map.getZoom(), 13)
    map.flyTo([site.lat, site.lng], targetZoom, { duration: 0.24 })
  }, [activeId, map, sites])

  return null
}

function LocateMeButton({
  locating,
  onLocate,
}: {
  locating: boolean
  onLocate: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onLocate}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
      className="glass-strong absolute right-3 top-16 z-10 flex h-11 w-11 items-center justify-center rounded-full text-ink shadow-glass-sm ring-1 ring-white/10 sm:w-auto sm:gap-2 sm:px-3"
      aria-label="Ir a mi zona"
    >
      {locating ? <Navigation className="h-4 w-4 animate-pulse" /> : <LocateFixed className="h-4 w-4" />}
      <span className="hidden text-sm font-medium sm:inline">Mi zona</span>
    </motion.button>
  )
}

function LocateMeControl() {
  const map = useMap()
  const [locating, setLocating] = useState(false)

  const onLocate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (!isValidCoord(latitude, longitude)) {
          setLocating(false)
          return
        }
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 14), {
          duration: 0.35,
        })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 25_000 },
    )
  }

  return <LocateMeButton locating={locating} onLocate={onLocate} />
}
