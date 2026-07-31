import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { X } from 'lucide-react'
import { MapGoogleLinkButton, MapLocateControl, MapZoomControls } from '@/components/faro/map-controls'
import { MapResizeNotifier } from '@/components/faro/map-resize-notifier'
import { MapSectionErrorBoundary } from '@/components/faro/map-section-error-boundary'
import { createMissionMarkerIcon, createSiteMarkerIcon } from '@/components/faro/map-marker'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import { useMapData } from '@/hooks/useMapData'
import { usePublicNeeds } from '@/hooks/usePublicNeeds'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { useAuth, usePermissions } from '@/store/auth-context'
import { SITE_TYPE_LABELS, siteToNeedableType } from '@/lib/site-utils'
import { safeMapCenter, safeMarkerPosition, safeFlyTo } from '@/lib/geo'
import { filterMappableMissions, getMissionLatLng } from '@/lib/mission-location'
import type { Site } from '@/lib/types'
import { FARO_ROLES } from '@/lib/roles'

interface LogisticsMapScreenProps {
  onOpenDetail?: (site: Site) => void
}

type Selected =
  | { kind: 'site'; site: Site }
  | { kind: 'mission'; missionId: string; title: string; zone?: string }
  | null

/**
 * Mapa operativo limpio: mapa a pantalla completa + ficha simple al tocar marcador.
 * Sin dashboards, KPIs ni paneles laterales permanentes.
 */
export function LogisticsMapScreen({ onOpenDetail }: LogisticsMapScreenProps) {
  const { role, isVolunteer } = usePermissions()
  const { user } = useAuth()
  const mapData = useMapData({ userRole: role, userId: user?.id ?? null, location: null })
  const { data: publicNeeds = [] } = usePublicNeeds()
  const [selected, setSelected] = useState<Selected>(null)

  useRealtimeSync({
    channelName: 'logistics-map',
    tables: ['public_needs', 'missions', 'mission_assignments', 'hospitals', 'shelters', 'supply_centers'],
    invalidateKeys: [
      FARO_QUERY_KEYS.publicNeeds,
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.centers,
    ],
  })

  const center = useMemo(
    () => safeMapCenter(mapData.sites.map((s) => ({ lat: s.lat, lng: s.lng }))),
    [mapData.sites],
  )

  const missionMarkers = useMemo(() => {
    if (!isVolunteer && role !== FARO_ROLES.CASE_MANAGER) return []
    const open = publicNeeds.filter(
      (n) => n.callStatus === 'open' && n.locationPublic?.lat != null && n.locationPublic?.lng != null,
    )
    return filterMappableMissions(
      open.map((n) => ({
        id: n.id,
        title: n.title,
        status: 'open' as const,
        priority: n.priority,
        location: {
          lat: n.locationPublic.lat!,
          lng: n.locationPublic.lng!,
          zone: n.locationPublic.zone,
        },
        createdAt: n.createdAt,
      })),
    )
  }, [isVolunteer, role, publicNeeds])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <MapSectionErrorBoundary>
        <div className="relative min-h-0 flex-1">
          <MapContainer
            center={center}
            zoom={12}
            className="faro-map h-full w-full"
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
              attribution="&copy; OpenStreetMap"
            />
            <MapResizeNotifier />
            <MapZoomControls />
            <MapLocateControl />
            <FitSites sites={mapData.sites} />

            {mapData.sites.map((site) => {
              const pos = safeMarkerPosition(site.lat, site.lng)
              if (!pos) return null
              const active = selected?.kind === 'site' && selected.site.id === site.id
              return (
                <Marker
                  key={site.id}
                  position={pos}
                  icon={createSiteMarkerIcon(site, active, !!selected && !active)}
                  zIndexOffset={active ? 1200 : 0}
                  eventHandlers={{
                    click: () => setSelected({ kind: 'site', site }),
                  }}
                />
              )
            })}

            {missionMarkers.map((m) => {
              const ll = getMissionLatLng(m)
              if (!ll) return null
              return (
                <Marker
                  key={`m-${m.id}`}
                  position={ll}
                  icon={createMissionMarkerIcon({ title: m.title, priority: m.priority })}
                  eventHandlers={{
                    click: () =>
                      setSelected({
                        kind: 'mission',
                        missionId: m.id,
                        title: m.title,
                        zone: m.location.zone,
                      }),
                  }}
                />
              )
            })}
          </MapContainer>

          {selected?.kind === 'site' && (
            <MapGoogleLinkButton
              lat={selected.site.lat}
              lng={selected.site.lng}
              label={selected.site.name}
              className="bottom-[calc(max(1rem,env(safe-area-inset-bottom))+7.5rem)]"
            />
          )}

          {selected && (
            <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[500] mx-auto max-w-md">
              <GlassCard className="!rounded-2xl !p-3.5 !shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {selected.kind === 'site' ? (
                      <>
                        <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                          {SITE_TYPE_LABELS[siteToNeedableType(selected.site)] ?? 'Centro'}
                        </p>
                        <p className="truncate text-sm font-semibold text-ink">{selected.site.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">
                          {selected.site.zone || 'Sin zona'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] uppercase tracking-wide text-ink-faint">Misión activa</p>
                        <p className="truncate text-sm font-semibold text-ink">{selected.title}</p>
                        {selected.zone && (
                          <p className="mt-0.5 text-xs text-ink-muted">{selected.zone}</p>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-lg p-1 text-ink-faint hover:bg-white/[0.06] hover:text-ink"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  {selected.kind === 'site' && onOpenDetail && (
                    <EmergencyButton
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => onOpenDetail(selected.site)}
                    >
                      Ver ficha
                    </EmergencyButton>
                  )}
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelected(null)}
                  >
                    Cerrar
                  </EmergencyButton>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </MapSectionErrorBoundary>
    </div>
  )
}

function FitSites({ sites }: { sites: Site[] }) {
  const map = useMap()
  useEffect(() => {
    const first = sites.find((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    if (!first) return
    safeFlyTo(map, first.lat, first.lng, { zoom: 12 })
  }, [map, sites])
  return null
}
