import { useEffect, useMemo, useRef } from 'react'
import { latLngBounds } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { motion } from 'framer-motion'
import { createSiteMarkerIcon } from './map-marker'
import { MapGoogleLinkButton, MapLocateControl, MapZoomControls } from './map-controls'
import { MapResizeNotifier } from './map-resize-notifier'
import { safeFlyTo } from '@/lib/geo'
import { cn, isValidCoord, defaultMapCenter } from '@/lib/utils'
import type { Site } from '@/lib/types'

interface MapCanvasProps {
  sites: Site[]
  activeId?: string | null
  onSelect?: (site: Site) => void
  className?: string
  autoFit?: boolean
  showControls?: boolean
}

function sitesWithCoords(sites: Site[]): Site[] {
  return sites.filter((s) => isValidCoord(s.lat, s.lng))
}

export function MapCanvas({
  sites,
  activeId,
  onSelect,
  className,
  autoFit = true,
  showControls = true,
}: MapCanvasProps) {
  const mappableSites = useMemo(() => sitesWithCoords(sites), [sites])

  const center: [number, number] = useMemo(() => {
    if (!mappableSites.length) return defaultMapCenter()
    const lat = mappableSites.reduce((acc, s) => acc + s.lat, 0) / mappableSites.length
    const lng = mappableSites.reduce((acc, s) => acc + s.lng, 0) / mappableSites.length
    return isValidCoord(lat, lng) ? [lat, lng] : defaultMapCenter()
  }, [mappableSites])

  const activeSite = useMemo(
    () => mappableSites.find((s) => s.id === activeId) ?? null,
    [mappableSites, activeId],
  )

  return (
    <div className={cn('relative h-full w-full overflow-hidden touch-none', className)}>
      <MapContainer
        className="faro-map h-full w-full"
        center={center}
        zoom={12}
        minZoom={5}
        maxZoom={18}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom
        touchZoom
        doubleClickZoom
        dragging
        preferCanvas
      >
        <TileLayer
          className="faro-map-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizeNotifier />
        {autoFit && <FitToSitesOnce sites={mappableSites} />}
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
        {showControls && (
          <>
            <MapZoomControls />
            <MapLocateControl />
          </>
        )}
      </MapContainer>

      {showControls && activeSite && (
        <MapGoogleLinkButton
          lat={activeSite.lat}
          lng={activeSite.lng}
          label={activeSite.name}
          className="bottom-4 lg:bottom-6"
        />
      )}

      <motion.div
        initial={false}
        animate={{ opacity: activeId ? 0.12 : 0 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        className="pointer-events-none absolute inset-0 bg-black"
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_30%,transparent_55%,rgba(11,17,32,0.45)_100%)]" />
    </div>
  )
}

function FitToSitesOnce({ sites }: { sites: Site[] }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (fittedRef.current || !sites.length) return
    const bounds = latLngBounds(sites.map((s) => [s.lat, s.lng] as [number, number]))
    if (!bounds.isValid()) return
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 })
    fittedRef.current = true
  }, [map, sites])

  return null
}

function FocusActiveSite({ sites, activeId }: { sites: Site[]; activeId?: string | null }) {
  const map = useMap()

  useEffect(() => {
    if (!activeId) return
    const site = sites.find((s) => s.id === activeId)
    if (!site || !isValidCoord(site.lat, site.lng)) return

    safeFlyTo(map, site.lat, site.lng, {
      zoom: Math.max(map.getZoom(), 14),
      duration: 0.24,
      context: { entityId: site.id, entityType: 'site', title: site.name, action: 'FocusActiveSite' },
    })
  }, [activeId, map, sites])

  return null
}
