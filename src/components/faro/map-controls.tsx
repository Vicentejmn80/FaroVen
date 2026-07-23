import { useState, type ReactNode } from 'react'
import { Minus, Navigation, Plus, ExternalLink } from 'lucide-react'
import { useMap } from 'react-leaflet'
import { motion } from 'framer-motion'
import { buildGoogleMapsViewLink, isValidCoord, openExternalNavigation } from '@/lib/utils'
import { safeFlyTo } from '@/lib/geo'
import { cn } from '@/lib/utils'

export function MapZoomControls({ className }: { className?: string }) {
  const map = useMap()

  return (
    <div className={cn('absolute right-3 top-3 z-[1000] flex flex-col gap-1.5', className)}>
      <MapControlButton
        label="Acercar"
        onClick={() => map.zoomIn()}
        icon={<Plus className="h-4 w-4" strokeWidth={2.25} />}
      />
      <MapControlButton
        label="Alejar"
        onClick={() => map.zoomOut()}
        icon={<Minus className="h-4 w-4" strokeWidth={2.25} />}
      />
    </div>
  )
}

export function MapLocateControl({ className }: { className?: string }) {
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
        safeFlyTo(map, latitude, longitude, {
          zoom: Math.max(map.getZoom(), 14),
          duration: 0.35,
          context: { action: 'MapLocateControl' },
        })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 25_000 },
    )
  }

  return (
    <div className={cn('absolute right-3 top-[6.5rem] z-[1000]', className)}>
      <MapControlButton
        label="Ir a mi zona"
        onClick={onLocate}
        icon={
          locating ? (
            <Navigation className="h-4 w-4 animate-pulse" />
          ) : (
            <Navigation className="h-4 w-4" strokeWidth={2} />
          )
        }
      />
    </div>
  )
}

export function MapGoogleLinkButton({
  lat,
  lng,
  label,
  className,
}: {
  lat?: number | null
  lng?: number | null
  label?: string | null
  className?: string
}) {
  const parsedLat = lat ?? NaN
  const parsedLng = lng ?? NaN
  if (!isValidCoord(parsedLat, parsedLng)) return null

  const viewUrl = buildGoogleMapsViewLink(parsedLat, parsedLng, label)

  return (
    <div className={cn('absolute left-3 bottom-3 z-[1000] flex flex-col gap-1.5 sm:flex-row', className)}>
      <MapControlButton
        label="Abrir en Google Maps"
        onClick={() => openExternalNavigation({ lat: parsedLat, lng: parsedLng, name: label })}
        icon={<Navigation className="h-4 w-4" strokeWidth={2} />}
        text="Cómo llegar"
      />
      {viewUrl && (
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-strong inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink shadow-glass-sm ring-1 ring-white/10 transition-colors hover:bg-white/[0.08]"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Ver en Maps</span>
        </a>
      )}
    </div>
  )
}

function MapControlButton({
  label,
  onClick,
  icon,
  text,
  className,
}: {
  label: string
  onClick: () => void
  icon: ReactNode
  text?: string
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      aria-label={label}
      className={cn(
        'glass-strong flex h-11 items-center justify-center rounded-full text-ink shadow-glass-sm ring-1 ring-white/10',
        text ? 'gap-2 px-3.5 text-sm font-medium' : 'w-11',
        className,
      )}
    >
      {icon}
      {text && <span>{text}</span>}
    </motion.button>
  )
}
