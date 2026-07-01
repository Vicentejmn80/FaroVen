import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { CARACAS_CENTER } from '@/prototype-v2/lib/geo'
import { getGoogleMapsLink, timeAgo } from '@/lib/utils'
import { SectionGuide } from './SectionGuide'
import { ViewHint } from './ViewHint'
import { getNavHint } from '../lib/nav-config'
import { SEVERITY_LABEL, type SiteCardData, type Severity } from '../lib/useSiteCards'

const PIN_COLOR: Record<Severity, string> = {
  critical: '#e36c6c',
  high: '#f2c463',
  medium: '#f2c463',
  covered: '#7bc67f',
}

function buildIcon(severity: Severity): L.DivIcon {
  return L.divIcon({
    className: 'pv3-pin-wrap',
    html: `<div class="pv3-pin" style="background:${PIN_COLOR[severity]}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

interface CoverageMapProps {
  sites: SiteCardData[]
  isLoading: boolean
  onReport: (site: SiteCardData) => void
  onBack: () => void
}

export function CoverageMap({ sites, isLoading, onReport, onBack }: CoverageMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const didFitRef = useRef(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const located = useMemo(() => sites.filter((s) => s.coords), [sites])
  const selected = useMemo(() => sites.find((s) => s.id === selectedId) ?? null, [sites, selectedId])

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = L.map(containerRef.current, {
      center: [CARACAS_CENTER.lat, CARACAS_CENTER.lng],
      zoom: 11,
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

  // Sincroniza marcadores con los sitios ubicables.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const existing = markersRef.current
    const nextIds = new Set<string>()

    for (const site of located) {
      if (!site.coords) continue
      nextIds.add(site.id)
      const icon = buildIcon(site.severity)
      let marker = existing.get(site.id)
      if (marker) {
        marker.setLatLng([site.coords.lat, site.coords.lng])
        marker.setIcon(icon)
      } else {
        marker = L.marker([site.coords.lat, site.coords.lng], { icon, title: site.name })
        marker.on('click', () => setSelectedId(site.id))
        marker.addTo(map)
        existing.set(site.id, marker)
      }
    }

    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    }

    if (!didFitRef.current && nextIds.size > 0) {
      const bounds = L.latLngBounds(
        located.filter((s) => s.coords).map((s) => [s.coords!.lat, s.coords!.lng] as [number, number])
      )
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
        didFitRef.current = true
      }
    }
  }, [located])

  const mapHref = selected
    ? getGoogleMapsLink({
        name: selected.name,
        address: selected.address,
        latitude: selected.coords?.lat ?? null,
        longitude: selected.coords?.lng ?? null,
      })
    : null

  return (
    <section className="pv3-coverage">
      <div className="pv3-view-header">
        <div>
          <h2 className="pv3-view-title">Zonas con poca cobertura</h2>
          <ViewHint>{getNavHint('coverage')}</ViewHint>
        </div>
        <button className="pv3-btn" onClick={onBack}>
          Volver a inicio
        </button>
      </div>

      <SectionGuide id="coverage">
        Los pines usan color según cobertura: <strong>rojo</strong> baja, <strong>amarillo</strong> parcial,{' '}
        <strong>verde</strong> buena. Toca o haz clic en un pin para ver necesidades, dirección y reportar un cambio.
      </SectionGuide>

      {isLoading && <div className="pv3-empty" style={{ marginBottom: 12 }}>Cargando mapa…</div>}

      <div className="pv3-coverage" style={{ position: 'relative' }}>
        <div ref={containerRef} className="pv3-map" />

        <div className="pv3-legend">
          <div className="pv3-legend__row"><span className="pv3-dot" style={{ background: '#e36c6c' }} /> Roja: baja cobertura</div>
          <div className="pv3-legend__row"><span className="pv3-dot" style={{ background: '#f2c463' }} /> Amarilla: cobertura parcial</div>
          <div className="pv3-legend__row"><span className="pv3-dot" style={{ background: '#7bc67f' }} /> Verde: buena cobertura</div>
        </div>

        {selected && (
          <aside className="pv3-panel">
            <button className="pv3-panel__close" onClick={() => setSelectedId(null)} aria-label="Cerrar">
              ✕
            </button>
            <h3 style={{ margin: '6px 0 4px' }}>{selected.name}</h3>
            {selected.address && <div className="pv3-sub" style={{ marginBottom: 8 }}>{selected.address}</div>}
            <span className={`pv3-badge pv3-badge--${selected.severity}`}>{SEVERITY_LABEL[selected.severity]}</span>
            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              {selected.needs.length === 0 ? (
                <div className="pv3-sub">Sin necesidades activas.</div>
              ) : (
                selected.needs.map((n) => (
                  <div className="pv3-sub" key={n.id}>
                    • {n.name}: {n.qtyReceived}/{n.qtyRequired} {n.unit} ({n.pct}%)
                  </div>
                ))
              )}
            </div>
            {selected.notAccepts.length > 0 && (
              <div className="pv3-nollevar"><strong>No llevar:</strong> {selected.notAccepts.join(', ')}</div>
            )}
            <div className="pv3-sub" style={{ marginTop: 10 }}>Actualizado {timeAgo(selected.updatedAt)}</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <button className="pv3-btn pv3-btn--primary" onClick={() => onReport(selected)}>
                Reportar un cambio
              </button>
              {mapHref && (
                <a className="pv3-btn" href={mapHref} target="_blank" rel="noopener noreferrer">
                  Ir al sitio
                </a>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}
