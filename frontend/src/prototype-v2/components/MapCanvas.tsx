import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { MapEntity } from '../lib/useMapData'
import { CARACAS_CENTER } from '../lib/geo'
import { buildMarkerIcon } from './marker-icons'

interface MapCanvasProps {
  entities: MapEntity[]
  selectedId: string | null
  onSelect: (entity: MapEntity) => void
}

export function MapCanvas({ entities, selectedId, onSelect }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const selectRef = useRef(onSelect)
  const didFitRef = useRef(false)

  selectRef.current = onSelect

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const map = L.map(containerRef.current, {
      center: [CARACAS_CENTER.lat, CARACAS_CENTER.lng],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
      didFitRef.current = false
    }
  }, [])

  // Sincroniza los marcadores con las entidades.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const existing = markersRef.current
    const nextIds = new Set<string>()

    for (const entity of entities) {
      if (!entity.coords) continue
      nextIds.add(entity.id)
      const alert = entity.unmetCritical > 0
      const isSelected = entity.id === selectedId
      const icon = buildMarkerIcon(entity.kind, alert, isSelected)

      let marker = existing.get(entity.id)
      if (marker) {
        marker.setLatLng([entity.coords.lat, entity.coords.lng])
        marker.setIcon(icon)
      } else {
        marker = L.marker([entity.coords.lat, entity.coords.lng], {
          icon,
          title: entity.name,
        })
        marker.on('click', () => selectRef.current(entity))
        marker.addTo(map)
        existing.set(entity.id, marker)
      }
    }

    // Elimina marcadores que ya no existen.
    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    }

    // Ajusta el encuadre la primera vez que hay datos.
    if (!didFitRef.current && nextIds.size > 0) {
      const bounds = L.latLngBounds(
        entities.filter((e) => e.coords).map((e) => [e.coords!.lat, e.coords!.lng] as [number, number])
      )
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
        didFitRef.current = true
      }
    }
  }, [entities, selectedId])

  // Centra el mapa al seleccionar.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const entity = entities.find((e) => e.id === selectedId)
    if (entity?.coords) {
      map.panTo([entity.coords.lat, entity.coords.lng], { animate: true, duration: 0.4 })
    }
  }, [selectedId, entities])

  return <div ref={containerRef} className="pv2-map" />
}
