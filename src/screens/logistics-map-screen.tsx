import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { X } from 'lucide-react'
import { MapGoogleLinkButton, MapLocateControl, MapZoomControls } from '@/components/faro/map-controls'
import { MapResizeNotifier } from '@/components/faro/map-resize-notifier'
import { MapSectionErrorBoundary } from '@/components/faro/map-section-error-boundary'
import { createMissionMarkerIcon, createSiteMarkerIcon } from '@/components/faro/map-marker'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import {
  MissionDetailSheet,
  type VolunteerMissionDetail,
} from '@/components/volunteer/mission-detail-sheet'
import { useMapData } from '@/hooks/useMapData'
import { usePublicNeeds } from '@/hooks/usePublicNeeds'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { useAuth, usePermissions } from '@/store/auth-context'
import { SITE_TYPE_LABELS, siteToNeedableType } from '@/lib/site-utils'
import { isValidCoord, safeMapCenter, safeMarkerPosition, safeFlyTo } from '@/lib/geo'
import { filterMappableMissions, getMissionLatLng } from '@/lib/mission-location'
import type { Site } from '@/lib/types'
import { FARO_ROLES } from '@/lib/roles'
import type { PublicNeed } from '@/domain/public-need.types'
import { label, PRIORITY_SHORT_LABELS } from '@/lib/labels'

interface LogisticsMapScreenProps {
  onOpenDetail?: (site: Site) => void
}

type Selected =
  | { kind: 'site'; site: Site }
  | { kind: 'need'; need: PublicNeed }
  | null

/**
 * Mapa operativo = radar: centros + necesidades públicas abiertas.
 * Voluntario: pin tocable → sheet con «Ofrecer ayuda» (case_application).
 */
export function LogisticsMapScreen({ onOpenDetail }: LogisticsMapScreenProps) {
  const { role, isVolunteer } = usePermissions()
  const { user } = useAuth()
  const mapData = useMapData({ userRole: role, userId: user?.id ?? null, location: null })
  const { data: publicNeeds = [] } = usePublicNeeds()
  const [selected, setSelected] = useState<Selected>(null)

  useRealtimeSync({
    channelName: 'logistics-map',
    tables: [
      'public_needs',
      'missions',
      'mission_assignments',
      'case_applications',
      'hospitals',
      'shelters',
      'supply_centers',
    ],
    invalidateKeys: [
      FARO_QUERY_KEYS.publicNeeds,
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.caseApplications,
      FARO_QUERY_KEYS.centers,
    ],
  })

  const showOpenNeeds =
    isVolunteer ||
    role === FARO_ROLES.CASE_MANAGER ||
    role === FARO_ROLES.PUBLIC ||
    role === FARO_ROLES.COORDINATOR

  const openNeeds = useMemo(() => {
    if (!showOpenNeeds) return [] as PublicNeed[]
    return publicNeeds.filter((n) => {
      if (n.callStatus !== 'open' || n.visibilityStatus !== 'public') return false
      if (!['active', 'reserved', 'in_progress'].includes(n.status)) return false
      if (!n.caseId) return false
      const lat = Number(n.locationPublic?.lat)
      const lng = Number(n.locationPublic?.lng)
      return isValidCoord(lat, lng)
    })
  }, [publicNeeds, showOpenNeeds])

  const missionMarkers = useMemo(
    () =>
      filterMappableMissions(
        openNeeds.map((n) => ({
          id: n.id,
          title: n.title,
          status: 'open' as const,
          priority: n.priority,
          location: {
            lat: Number(n.locationPublic.lat),
            lng: Number(n.locationPublic.lng),
            zone: n.locationPublic.zone,
          },
          createdAt: n.createdAt,
          need: n,
        })),
      ),
    [openNeeds],
  )

  const center = useMemo(() => {
    const fromNeeds = openNeeds.map((n) => ({
      lat: Number(n.locationPublic.lat),
      lng: Number(n.locationPublic.lng),
    }))
    const fromSites = mapData.sites.map((s) => ({ lat: s.lat, lng: s.lng }))
    return safeMapCenter([...fromNeeds, ...fromSites])
  }, [mapData.sites, openNeeds])

  const volunteerMission: VolunteerMissionDetail | null = useMemo(() => {
    if (!isVolunteer || selected?.kind !== 'need') return null
    const need = selected.need
    const lat = Number(need.locationPublic.lat)
    const lng = Number(need.locationPublic.lng)
    return {
      id: need.id,
      caseId: need.caseId,
      title: need.title,
      requiredSkill: null,
      status: 'open',
      priority: need.priority,
      location: { lat, lng },
      createdAt: need.createdAt,
      siteName: need.locationPublic.address ?? need.locationPublic.zone ?? 'Zona cercana',
      zone: need.locationPublic.zone ?? 'Zona por confirmar',
      distanceKm: '—',
      description: need.summary,
      affectedPeople: null,
      expiresAt: need.expiresAt,
      required: need.requiredQuantity,
      available: need.coveredQuantity,
    }
  }, [isVolunteer, selected])

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
            <FitMapPoints sites={mapData.sites} needs={openNeeds} />

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
                  key={`need-${m.id}`}
                  position={ll}
                  icon={createMissionMarkerIcon({ title: m.title, priority: m.priority })}
                  eventHandlers={{
                    click: () => setSelected({ kind: 'need', need: m.need }),
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

          {selected?.kind === 'need' && !isVolunteer && (
            <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[500] mx-auto max-w-md">
              <GlassCard className="!rounded-2xl !p-3.5 !shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                      Necesidad abierta
                    </p>
                    <p className="truncate text-sm font-semibold text-ink">{selected.need.title}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      📍 {selected.need.locationPublic.zone ?? 'Zona'}
                      {' · '}
                      {selected.need.remainingQuantity} {selected.need.unit} · Prioridad{' '}
                      {label(PRIORITY_SHORT_LABELS, selected.need.priority)}
                    </p>
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
                <div className="mt-3">
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelected(null)}
                  >
                    Cerrar
                  </EmergencyButton>
                </div>
              </GlassCard>
            </div>
          )}

          {selected?.kind === 'site' && (
            <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[500] mx-auto max-w-md">
              <GlassCard className="!rounded-2xl !p-3.5 !shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                      {SITE_TYPE_LABELS[siteToNeedableType(selected.site)] ?? 'Centro'}
                    </p>
                    <p className="truncate text-sm font-semibold text-ink">{selected.site.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">
                      {selected.site.zone || 'Sin zona'}
                    </p>
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
                  {onOpenDetail && (
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

      {isVolunteer && (
        <MissionDetailSheet
          mission={volunteerMission}
          onClose={() => setSelected(null)}
          variant="sheet"
        />
      )}
    </div>
  )
}

function FitMapPoints({ sites, needs }: { sites: Site[]; needs: PublicNeed[] }) {
  const map = useMap()
  useEffect(() => {
    const site = sites.find((s) => isValidCoord(s.lat, s.lng))
    if (site) {
      safeFlyTo(map, site.lat, site.lng, { zoom: 12 })
      return
    }
    const need = needs[0]
    if (need) {
      const lat = Number(need.locationPublic.lat)
      const lng = Number(need.locationPublic.lng)
      if (isValidCoord(lat, lng)) safeFlyTo(map, lat, lng, { zoom: 12 })
    }
  }, [map, sites, needs])
  return null
}
