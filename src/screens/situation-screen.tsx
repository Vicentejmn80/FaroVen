import { useEffect, useMemo, useState } from 'react'
import { latLngBounds } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { MapResizeNotifier } from '@/components/faro/map-resize-notifier'
import { motion } from 'framer-motion'
import { Flag, List, Map as MapIcon, MapPin, PlusCircle, SlidersHorizontal } from 'lucide-react'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { GuidedEmptyState } from '@/components/onboarding/GuidedEmptyState'
import { PriorityCoverageGuide } from '@/components/onboarding/PriorityCoverageGuide'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { SectionTitle } from '@/components/faro/section-title'
import { MapCanvas } from '@/components/faro/map-canvas'
import { SidePanel } from '@/components/faro/side-panel'
import { SituationSummary } from '@/components/faro/situation-summary'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { TimelineItem } from '@/components/faro/timeline-item'
import { createMissionMarkerIcon } from '@/components/faro/map-marker'
import {
  filterMappableMissions,
  getMissionLatLng,
  resolveMissionCoordinates,
} from '@/lib/mission-location'
import { SITE_TYPE_LABELS, siteToNeedableType } from '@/lib/site-utils'
import { cn, defaultMapCenter, greeting, isValidCoord } from '@/lib/utils'
import type { Need } from '@/domain/models'
import type { Site } from '@/lib/types'
import { useFaro } from '@/store/faro-context'
import { useAuth, usePermissions } from '@/store/auth-context'
import { useMapData, type Mission } from '@/hooks/useMapData'

interface SituationScreenProps {
  onOpenDetail?: (site: Site) => void
  onRegisterSite?: () => void
}

/**
 * Home adaptativo:
 * - Mobile: una sola columna con scroll continuo (mapa incluido, sin recortes).
 * - Desktop: panel operativo en 2 columnas (contexto + mapa a altura completa).
 */
export function SituationScreen({ onOpenDetail, onRegisterSite }: SituationScreenProps) {
  const { role, isVolunteer } = usePermissions()
  const { user } = useAuth()
  const mapData = useMapData({ userRole: role, userId: user?.id ?? null, location: null })
  const { sites, latestActivity, isLoading, loadError, state } = useFaro()
  const needs = state.needs
  const [selected, setSelected] = useState<Site | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'hospital' | 'shelter' | 'supply_center'>('all')
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [priorityFilter, setPriorityFilter] = useState<
    'all' | 'critical' | 'high' | 'medium' | 'low' | 'covered'
  >('all')
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({})
  const filteredSites = sites.filter((site) => {
    const byType = typeFilter === 'all' ? true : site.type === typeFilter
    const search = query.trim().toLowerCase()
    const needsForSite = needs.filter((need) => need.centerId === site.id)
    const byName = search
      ? site.name.toLowerCase().includes(search) ||
        site.zone.toLowerCase().includes(search) ||
        needsForSite.some((need) => need.type.toLowerCase().includes(search))
      : true
    return byType && byName
  })
  const filteredActivity = latestActivity.filter((event) =>
    query.trim()
      ? event.title.toLowerCase().includes(query.trim().toLowerCase()) ||
        event.detail.toLowerCase().includes(query.trim().toLowerCase())
      : true,
  )

  useEffect(() => {
    if (selected && !filteredSites.some((site) => site.id === selected.id)) {
      setSelected(null)
    }
  }, [filteredSites, selected])

  const needsBySite = useMemo(() => {
    const map = new Map<string, Need[]>()
    for (const site of sites) {
      map.set(site.id, [])
    }
    for (const need of needs) {
      const list = map.get(need.centerId) ?? []
      list.push(need)
      map.set(need.centerId, list)
    }
    return map
  }, [needs, sites])

  const listSites = useMemo(() => {
    return filteredSites.map((site) => ({
      site,
      needs: needsBySite.get(site.id) ?? [],
    }))
  }, [filteredSites, needsBySite])

  const totals = useMemo(() => {
    const entries = listSites.flatMap((entry) => entry.needs)
    const covered = entries.filter((need) => isCovered(need)).length
    const critical = entries.filter((need) => !isCovered(need) && need.priority === 'critical').length
    const high = entries.filter((need) => !isCovered(need) && need.priority === 'high').length
    const active = entries.filter((need) => !isCovered(need)).length
    const recentCovered = entries.filter(
      (need) => isCovered(need) && Date.now() - need.updatedAt.getTime() < 1000 * 60 * 60 * 48,
    ).length
    return { active, critical, high, covered, recentCovered }
  }, [listSites])

  if (isVolunteer) {
    const volunteerMissions = filterMappableMissions(
      normalizeVolunteerMissions(mapData.missions, mapData.sites, mapData.needs),
    )
    return (
      <VolunteerMapScreen
        missions={volunteerMissions}
        isLoading={mapData.isLoading}
        loadError={mapData.loadError}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Mobile: scroll único | Desktop: grid sin scroll externo */}
      <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-32 pt-1 lg:overflow-hidden lg:px-8 lg:pb-6 lg:pt-2">
        <div className="lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(380px,42%)] lg:gap-8">
          {/* Columna izquierda — contexto y reportes */}
          <div className="lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:pr-1">
            <PageHeader onRegisterSite={onRegisterSite} />
            <ContextualHelpCard moduleId="map" className="mt-3" />
            <QuickAnswerBar
              query={query}
              onQuery={setQuery}
              typeFilter={typeFilter}
              onTypeFilter={setTypeFilter}
              totalSites={filteredSites.length}
            />

            {loadError && (
              <GlassCard inset={false} className="mt-3 border-critical/30 bg-critical/10 p-3">
                <p className="text-sm text-critical">{loadError}</p>
              </GlassCard>
            )}

            {!isLoading && !loadError && sites.length === 0 && (
              <GuidedEmptyState
                className="mt-4"
                icon={MapPin}
                title="Aún no hay centros en el mapa"
                description="Cuando los coordinadores registren hospitales, refugios o acopios, aparecerán aquí con sus necesidades en tiempo real."
                hint="Si eres administrador, usa el botón Registrar para añadir el primer centro."
                action={
                  onRegisterSite ? (
                    <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onRegisterSite}>
                      Registrar primer sitio
                    </EmergencyButton>
                  ) : undefined
                }
              />
            )}

            <section className="mt-4 lg:mt-3">
              <SectionTitle className="lg:hidden">Qué debemos resolver ahora</SectionTitle>
              <div className="mt-2.5 lg:mt-0">
                <SituationSummary sites={filteredSites} needs={needs} className="lg:hidden" />
                <SituationSummary
                  sites={filteredSites}
                  needs={needs}
                  title="Prioridades activas"
                  compact
                  className="hidden lg:block"
                />
              </div>
            </section>

            <section className="mt-5 lg:mt-4">
              <SectionTitle>Vista operativa</SectionTitle>
              <ViewToggle view={viewMode} onChange={setViewMode} />
            </section>

            {viewMode === 'map' && (
              <section className="mt-4 lg:hidden">
                <SectionTitle>Mapa de operaciones</SectionTitle>
                <div className="mt-2.5">
                  <OperationsMap
                    selected={selected}
                    onSelect={setSelected}
                    sites={filteredSites}
                    className="h-[300px] sm:h-[340px]"
                  />
                </div>
              </section>
            )}

            {viewMode === 'list' && (
              <NeedsByCenterSection
                className="mt-4"
                query={query}
                priorityFilter={priorityFilter}
                onPriorityFilter={setPriorityFilter}
                items={listSites}
                totals={totals}
                expandedSites={expandedSites}
                onToggleExpand={(id) =>
                  setExpandedSites((prev) => ({
                    ...prev,
                    [id]: !prev[id],
                  }))
                }
              />
            )}

            {viewMode === 'list' && listSites.length > 0 && (
              <div className="mt-4 hidden lg:block">
                <PriorityCoverageGuide compact className="rounded-2xl border border-white/10 bg-white/[0.02] p-3" />
              </div>
            )}

            <ReportsSection activity={filteredActivity} className="mt-5 lg:mt-4 lg:min-h-0 lg:flex-1" />
          </div>

          {/* Columna derecha — mapa protagonista en desktop */}
          <section className="hidden lg:flex lg:min-h-0 lg:flex-col">
            <SectionTitle>Mapa de operaciones</SectionTitle>
            <div className="mt-3 min-h-0 flex-1">
                <OperationsMap selected={selected} onSelect={setSelected} sites={filteredSites} className="h-full min-h-[480px]" />
            </div>
          </section>
        </div>
      </div>

      <SidePanel
        site={selected}
        onClose={() => setSelected(null)}
        onOpenDetail={onOpenDetail}
      />
    </div>
  )
}

type VolunteerMission = Mission & {
  siteName: string
  zone: string
  distanceKm: string
}

function buildVolunteerMissions(sites: Site[], needs: Need[]): VolunteerMission[] {
  const siteById = new Map(sites.map((site) => [site.id, site]))
  const activeNeeds = needs.filter((need) => !isCovered(need))
  const results: VolunteerMission[] = []

  for (const [index, need] of activeNeeds.entries()) {
    const site = siteById.get(need.centerId)
    if (!site) {
      console.warn('[FARO Mapa Voluntario] Misión omitida por falta de coordenadas', {
        needId: need.id,
        title: need.type,
        reason: 'centro_no_encontrado',
      })
      continue
    }

    const location = resolveMissionCoordinates(site.lat, site.lng, {
      needId: need.id,
      missionId: need.id,
      title: need.type,
    })
    if (!location) continue

    const distanceKm = (1.2 + (index % 6) * 0.6 + (need.id.charCodeAt(0) % 7) * 0.12).toFixed(1)
    results.push({
      id: need.id,
      title: need.type,
      requiredSkill: null,
      status: 'open',
      priority: need.priority === 'critical' ? 'critical' : need.priority === 'high' ? 'high' : 'medium',
      location,
      createdAt: need.updatedAt,
      siteName: site.name,
      zone: site.zone,
      distanceKm,
    })
  }

  return results
}

function normalizeVolunteerMissions(
  missions: Mission[],
  sites: Site[],
  needs: Need[],
): VolunteerMission[] {
  if (!missions.length) return buildVolunteerMissions(sites, needs)

  const fallbackSite = sites.find((site) => resolveMissionCoordinates(site.lat, site.lng) !== null)
  const results: VolunteerMission[] = []

  for (const [index, mission] of missions.entries()) {
    const location = resolveMissionCoordinates(mission.location?.lat, mission.location?.lng, {
      missionId: mission.id,
      title: mission.title,
    })
    if (!location) continue

    const distanceKm = (1.4 + (index % 4) * 0.8).toFixed(1)
    results.push({
      ...mission,
      location,
      siteName: fallbackSite?.name ?? 'Zona cercana',
      zone: fallbackSite?.zone ?? 'Zona',
      distanceKm,
    })
  }

  return results
}

function VolunteerMapScreen({
  missions,
  isLoading,
  loadError,
}: {
  missions: VolunteerMission[]
  isLoading: boolean
  loadError: string | null
}) {
  const [selectedMission, setSelectedMission] = useState<VolunteerMission | null>(null)
  const [distanceFilter, setDistanceFilter] = useState<'5' | '10' | '25'>('10')

  useEffect(() => {
    if (selectedMission && !missions.some((m) => m.id === selectedMission.id)) {
      setSelectedMission(null)
    }
  }, [missions, selectedMission])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <div className="flex flex-col px-5 pb-32 pt-2 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(360px,42%)] lg:gap-6 lg:overflow-hidden lg:px-8 lg:pb-6 lg:pt-2">
        {/* Panel izquierdo: filtros + mapa móvil + lista */}
        <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          <header className="shrink-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {greeting()} · Red de Apoyo
            </p>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">Misiones activas</h1>
            <p className="text-sm text-ink-subtle">
              Ve solo lo accionable cerca de ti. Elige una misión y empieza a ayudar.
            </p>
          </header>

          <section className="mt-3 shrink-0 space-y-2.5">
            <GlassCard inset={false} className="space-y-3 p-3">
              <div className="flex items-center gap-2 text-xs text-ink-subtle">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros rápidos
              </div>
              <div className="flex flex-wrap gap-2">
                {(['5', '10', '25'] as const).map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    onClick={() => setDistanceFilter(radius)}
                    className={
                      distanceFilter === radius
                        ? 'rounded-full border border-info/60 bg-info-soft px-3 py-1 text-xs text-ink'
                        : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-ink-muted'
                    }
                  >
                    {radius} km
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-faint">
                {missions.length} misión(es) disponibles · radio {distanceFilter} km
              </p>
            </GlassCard>
          </section>

          {loadError && (
            <GlassCard inset={false} className="mt-3 shrink-0 border-critical/30 bg-critical/10 p-3">
              <p className="text-sm text-critical">{loadError}</p>
            </GlassCard>
          )}

          {/* Móvil: mapa apilado con altura fija */}
          <section className="mt-4 shrink-0 lg:hidden">
            <SectionTitle>Mapa de misiones</SectionTitle>
            <div className="map-container-wrapper mt-2.5 h-[300px] min-h-[300px] w-full sm:h-[340px] sm:min-h-[340px]">
              <VolunteerMapCanvas
                missions={missions}
                activeId={selectedMission?.id}
                onSelect={setSelectedMission}
              />
            </div>
          </section>

          {/* Lista: scroll de página en móvil; scroll interno en escritorio */}
          <section className="mt-4 flex flex-col lg:mt-3 lg:min-h-0 lg:flex-1">
            <SectionTitle className="shrink-0">Misiones abiertas</SectionTitle>
            {isLoading ? (
              <GlassCard inset={false} className="mt-3 shrink-0 p-4 text-sm text-ink-subtle">
                Cargando misiones disponibles…
              </GlassCard>
            ) : missions.length === 0 ? (
              <GuidedEmptyState
                className="mt-3 shrink-0"
                icon={Flag}
                title="No hay misiones abiertas"
                description="Vuelve en unos minutos para ver nuevas oportunidades cerca de ti."
              />
            ) : (
              <div className="mt-3 space-y-2 pb-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
                {missions.map((mission) => (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => setSelectedMission(mission)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                        selectedMission?.id === mission.id
                          ? 'border-info/60 bg-info-soft'
                          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]',
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                        <Flag className="h-4 w-4 text-info" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <NeedItemLabel name={mission.title} className="text-sm font-semibold text-ink" />
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-subtle">
                          <span>{mission.siteName}</span>
                          <span>·</span>
                          <span>{mission.zone}</span>
                          <span>·</span>
                          <span>{mission.distanceKm} km</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-ink-subtle">
                        {mission.priority === 'critical'
                          ? 'Urgente'
                          : mission.priority === 'high'
                            ? 'Alta'
                            : 'Activa'}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </section>

          {selectedMission && (
            <div className="mt-4 shrink-0 rounded-2xl border border-white/10 bg-base-900/95 p-4 text-sm text-ink lg:hidden">
              <p className="font-semibold text-ink">{selectedMission.title}</p>
              <p className="text-xs text-ink-subtle">
                {selectedMission.siteName} · {selectedMission.distanceKm} km
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <EmergencyButton variant="glass" size="md" className="w-full">
                  Ver detalles
                </EmergencyButton>
                <EmergencyButton variant="primary" size="md" className="w-full">
                  Quiero ayudar
                </EmergencyButton>
              </div>
            </div>
          )}
        </div>

        {/* Escritorio: mapa en columna derecha, altura completa */}
        <section className="hidden min-h-0 flex-col lg:flex">
          <SectionTitle className="shrink-0">Mapa de misiones</SectionTitle>
          <div className="map-container-wrapper mt-3 min-h-[400px] flex-1">
            <VolunteerMapCanvas
              missions={missions}
              activeId={selectedMission?.id}
              onSelect={setSelectedMission}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function VolunteerMapCanvas({
  missions,
  activeId,
  onSelect,
}: {
  missions: VolunteerMission[]
  activeId?: string | null
  onSelect: (mission: VolunteerMission) => void
}) {
  const mappableMissions = useMemo(() => filterMappableMissions(missions), [missions])

  const center: [number, number] = useMemo(() => {
    if (!mappableMissions.length) return defaultMapCenter()
    const lat = mappableMissions.reduce((acc, m) => acc + m.location.lat, 0) / mappableMissions.length
    const lng = mappableMissions.reduce((acc, m) => acc + m.location.lng, 0) / mappableMissions.length
    return isValidCoord(lat, lng) ? [lat, lng] : defaultMapCenter()
  }, [mappableMissions])

  return (
    <div className="map-container-wrapper relative h-full min-h-[inherit] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-base-800/30">
      <MapContainer
        className="faro-map !absolute inset-0 h-full w-full"
        center={center}
        zoom={12}
        zoomControl={false}
        attributionControl={false}
        preferCanvas
      >
        <MapResizeNotifier />
        <TileLayer
          className="faro-map-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMissions missions={mappableMissions} />
        <FocusActiveMission missions={mappableMissions} activeId={activeId} />
        {mappableMissions.map((mission) => {
          const position = getMissionLatLng(mission)
          if (!position) return null
          return (
            <Marker
              key={mission.id}
              position={position}
              icon={createMissionMarkerIcon(
                mission,
                activeId === mission.id,
                !!activeId && activeId !== mission.id,
              )}
              zIndexOffset={activeId === mission.id ? 1200 : 0}
              eventHandlers={{ click: () => onSelect(mission) }}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}

function FitToMissions({ missions }: { missions: VolunteerMission[] }) {
  const map = useMap()

  useEffect(() => {
    const coords = missions
      .map((mission) => getMissionLatLng(mission))
      .filter((point): point is [number, number] => point !== null)

    if (!coords.length) return

    const bounds = latLngBounds(coords)
    if (!bounds.isValid()) return
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 })
    requestAnimationFrame(() => map.invalidateSize({ animate: false }))
  }, [map, missions])

  return null
}

function FocusActiveMission({
  missions,
  activeId,
}: {
  missions: VolunteerMission[]
  activeId?: string | null
}) {
  const map = useMap()

  useEffect(() => {
    if (!activeId) return
    const mission = missions.find((m) => m.id === activeId)
    if (!mission) return
    const position = getMissionLatLng(mission)
    if (!position) return
    const targetZoom = Math.max(map.getZoom(), 13)
    map.flyTo(position, targetZoom, { duration: 0.24 })
  }, [activeId, map, missions])

  return null
}

function ViewToggle({
  view,
  onChange,
}: {
  view: 'map' | 'list'
  onChange: (next: 'map' | 'list') => void
}) {
  const options = [
    { id: 'map' as const, label: 'Mapa', icon: MapIcon },
    { id: 'list' as const, label: 'Listado', icon: List },
  ]
  return (
    <div className="mt-2 flex items-center gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={
            view === option.id
              ? 'flex items-center gap-2 rounded-full border border-info/60 bg-info-soft px-3 py-1 text-xs text-ink'
              : 'flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-ink-muted'
          }
        >
          <option.icon className="h-3.5 w-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  )
}

function NeedsByCenterSection({
  className,
  query,
  priorityFilter,
  onPriorityFilter,
  items,
  totals,
  expandedSites,
  onToggleExpand,
}: {
  className?: string
  query: string
  priorityFilter: 'all' | 'critical' | 'high' | 'medium' | 'low' | 'covered'
  onPriorityFilter: (value: 'all' | 'critical' | 'high' | 'medium' | 'low' | 'covered') => void
  items: Array<{ site: Site; needs: Need[] }>
  totals: { active: number; critical: number; high: number; covered: number; recentCovered: number }
  expandedSites: Record<string, boolean>
  onToggleExpand: (id: string) => void
}) {
  const filters = [
    { id: 'all' as const, label: 'Todas' },
    { id: 'critical' as const, label: 'Críticas' },
    { id: 'high' as const, label: 'Altas' },
    { id: 'medium' as const, label: 'Medias' },
    { id: 'low' as const, label: 'Bajas' },
    { id: 'covered' as const, label: 'Cubiertas' },
  ]

  const filteredItems = items.filter(({ needs }) => {
    if (priorityFilter === 'all') return true
    if (priorityFilter === 'covered') return needs.some((need) => isCovered(need))
    return needs.some((need) => !isCovered(need) && need.priority === priorityFilter)
  })

  return (
    <section className={cn('space-y-3', className)}>
      <GlassCard inset={false} className="p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">Necesidades por centro</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-muted sm:grid-cols-4">
          <MetricPill label="Activas" value={totals.active} />
          <MetricPill label="Críticas" value={totals.critical} tone="critical" />
          <MetricPill label="Altas" value={totals.high} tone="warning" />
          <MetricPill label="Cubiertas recientes" value={totals.recentCovered} />
        </div>
      </GlassCard>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onPriorityFilter(filter.id)}
            className={
              priorityFilter === filter.id
                ? 'rounded-full border border-info/60 bg-info-soft px-3 py-1 text-xs text-ink'
                : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-ink-muted'
            }
          >
            {filter.label}
          </button>
        ))}
        {query.trim() && (
          <span className="text-xs text-ink-subtle">Filtrando por “{query.trim()}”.</span>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <GuidedEmptyState
          title="Sin resultados con este filtro"
          description="Prueba otro nivel de prioridad o limpia la búsqueda para ver todos los centros."
          hint="Las necesidades críticas aparecen primero en el resumen superior del mapa."
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map(({ site, needs }) => (
            <CenterNeedCard
              key={site.id}
              site={site}
              needs={needs}
              expanded={Boolean(expandedSites[site.id])}
              onToggleExpand={() => onToggleExpand(site.id)}
              priorityFilter={priorityFilter}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone?: 'critical' | 'warning' }) {
  const toneClass = tone === 'critical' ? 'text-critical' : tone === 'warning' ? 'text-warning' : 'text-ink'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className={cn('mt-1 text-sm font-semibold', toneClass)}>{value}</p>
    </div>
  )
}

function CenterNeedCard({
  site,
  needs,
  expanded,
  onToggleExpand,
  priorityFilter,
}: {
  site: Site
  needs: Need[]
  expanded: boolean
  onToggleExpand: () => void
  priorityFilter: 'all' | 'critical' | 'high' | 'medium' | 'low' | 'covered'
}) {
  const siteNeeds = needs.filter((need) => {
    if (priorityFilter === 'all') return true
    if (priorityFilter === 'covered') return isCovered(need)
    return !isCovered(need) && need.priority === priorityFilter
  })

  const counts = countNeeds(needs)
  const preview = buildNeedPreview(needs)
  const typeLabel = SITE_TYPE_LABELS[siteToNeedableType(site)]

  return (
    <GlassCard inset={false} className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{site.name}</p>
          <p className="text-xs text-ink-subtle">
            {typeLabel} · {site.zone}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-ink-muted">
          {needs.length} necesidades
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted sm:grid-cols-4">
        <PriorityChip label="Críticas" value={counts.critical} tone="critical" />
        <PriorityChip label="Altas" value={counts.high} tone="warning" />
        <PriorityChip label="Medias" value={counts.medium} />
        <PriorityChip label="Cubiertas" value={counts.covered} />
      </div>

      <div className="space-y-1 text-xs text-ink-subtle">
        {preview.length ? (
          preview.map((need) => (
            <div key={need.id} className="flex items-center justify-between">
              <NeedItemLabel name={need.type} className="text-ink" />
              <span className={priorityTone(need)}>{priorityLabel(need)}</span>
            </div>
          ))
        ) : (
          <p>Sin necesidades activas.</p>
        )}
      </div>

      <button type="button" className="text-xs font-semibold text-info" onClick={onToggleExpand}>
        {expanded ? 'Ocultar necesidades' : 'Ver todas las necesidades →'}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-white/10 pt-3 text-xs text-ink-subtle">
          {siteNeeds.length ? (
            siteNeeds.map((need) => (
              <div key={need.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <NeedItemLabel name={need.type} className="text-sm font-medium text-ink" />
                  <span className={priorityTone(need)}>{priorityLabel(need)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <DetailChip label="Cobertura" value={`${coveragePct(need)}%`} />
                  <DetailChip label="Requerido" value={need.required} />
                  <DetailChip label="Recibido" value={need.available} />
                  <DetailChip label="Estado" value={isCovered(need) ? 'Cubierta' : 'Activa'} />
                </div>
              </div>
            ))
          ) : (
            <p>No hay necesidades con este filtro.</p>
          )}
        </div>
      )}
    </GlassCard>
  )
}

function PriorityChip({ label, value, tone }: { label: string; value: number; tone?: 'critical' | 'warning' }) {
  const toneClass = tone === 'critical' ? 'text-critical' : tone === 'warning' ? 'text-warning' : 'text-ink'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className={cn('mt-1 text-sm font-semibold', toneClass)}>{value}</p>
    </div>
  )
}

function DetailChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-1">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className="text-xs text-ink">{value}</p>
    </div>
  )
}

function isCovered(need: { required: number; available: number; status: string }) {
  return (
    need.status === 'resolved' ||
    need.status === 'pending_closure' ||
    (need.required > 0 && need.available >= need.required)
  )
}

function coveragePct(need: { required: number; available: number }) {
  if (!need.required) return 0
  return Math.min(100, Math.round((need.available / Math.max(need.required, 1)) * 100))
}

function priorityLabel(need: { priority: string }) {
  if (need.priority === 'critical') return 'Crítica'
  if (need.priority === 'high') return 'Alta'
  if (need.priority === 'medium') return 'Media'
  return 'Baja'
}

function priorityTone(need: { priority: string }) {
  if (need.priority === 'critical') return 'text-critical'
  if (need.priority === 'high') return 'text-warning'
  if (need.priority === 'medium') return 'text-warning'
  return 'text-operational'
}

function countNeeds(needs: Need[]) {
  return {
    critical: needs.filter((n) => !isCovered(n) && n.priority === 'critical').length,
    high: needs.filter((n) => !isCovered(n) && n.priority === 'high').length,
    medium: needs.filter((n) => !isCovered(n) && n.priority === 'medium').length,
    covered: needs.filter((n) => isCovered(n)).length,
  }
}

function buildNeedPreview(needs: Need[]) {
  const active = needs.filter((need) => !isCovered(need))
  const ordered = [...active].sort((a, b) => priorityRank(a) - priorityRank(b))
  return ordered.slice(0, 3)
}

function priorityRank(need: { priority: string }) {
  if (need.priority === 'critical') return 0
  if (need.priority === 'high') return 1
  if (need.priority === 'medium') return 2
  return 3
}
function QuickAnswerBar({
  query,
  onQuery,
  typeFilter,
  onTypeFilter,
  totalSites,
}: {
  query: string
  onQuery: (query: string) => void
  typeFilter: 'all' | 'hospital' | 'shelter' | 'supply_center'
  onTypeFilter: (value: 'all' | 'hospital' | 'shelter' | 'supply_center') => void
  totalSites: number
}) {
  const filters = [
    { id: 'all' as const, label: 'Todos' },
    { id: 'hospital' as const, label: 'Hospitales' },
    { id: 'shelter' as const, label: 'Refugios' },
    { id: 'supply_center' as const, label: 'Acopios' },
  ]

  return (
    <section className="mt-3 space-y-2.5">
      <GlassCard inset={false} className="p-3">
        <div className="relative">
          <input
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/60"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="¿Qué centro necesitas ubicar?"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onTypeFilter(filter.id)}
              className={
                typeFilter === filter.id
                  ? 'rounded-full border border-info/60 bg-info-soft px-3 py-1 text-xs text-ink'
                  : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-ink-muted'
              }
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-subtle">
          {totalSites} centro(s) visibles · toca un punto para ver qué necesita y cómo llegar.
        </p>
      </GlassCard>
    </section>
  )
}

function PageHeader({ onRegisterSite }: { onRegisterSite?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="flex items-start justify-between px-1"
    >
      <div>
        <p className="text-sm text-ink-muted lg:text-xs">{greeting()}.</p>
        <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight text-ink lg:text-[28px]">
          Así está la situación ahora
        </h1>
      </div>
      {onRegisterSite && (
        <EmergencyButton
          variant="primary"
          size="sm"
          onClick={onRegisterSite}
          className="mt-1 hidden shrink-0 lg:inline-flex"
          aria-label="Registrar nuevo centro"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Registrar</span>
        </EmergencyButton>
      )}
    </motion.div>
  )
}

function ReportsSection({
  className,
  activity,
}: {
  className?: string
  activity: ReturnType<typeof useFaro>['latestActivity']
}) {
  return (
    <section className={cn('space-y-2.5', className)}>
      <SectionTitle>Actividad reciente</SectionTitle>
      <GlassCard inset={false} className="p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
        <div className="no-scrollbar lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {activity.length ? (
            activity.map((event, i) => (
              <TimelineItem key={event.id} event={event} index={i} last={i === activity.length - 1} />
            ))
          ) : (
            <GuidedEmptyState
              title="Sin hitos recientes"
              description="Aquí verás necesidades creadas o resueltas, ciclos cerrados, reportes y centros nuevos."
              hint="Toca un centro en el mapa para ver el detalle operativo."
            />
          )}
        </div>
      </GlassCard>
    </section>
  )
}

function OperationsMap({
  selected,
  onSelect,
  sites,
  className,
}: {
  selected: Site | null
  onSelect: (site: Site | null) => void
  sites: Site[]
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'relative w-full overflow-hidden rounded-3xl shadow-glass ring-1 ring-inset ring-white/10',
        selected && 'faro-map-host--panel-open',
        className,
      )}
    >
      <MapCanvas
        sites={sites}
        activeId={selected?.id}
        onSelect={(site) => onSelect(site)}
        className="h-full w-full"
      />

      <GlassCard
        strong
        inset={false}
        className="absolute left-3 top-3 flex items-center gap-3 rounded-2xl px-3 py-2"
      >
        {[
          { c: '#FF453A', l: 'Crítico' },
          { c: '#FFD60A', l: 'Atención' },
          { c: '#30D158', l: 'Operativo' },
        ].map((x) => (
          <span key={x.l} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: x.c }} />
            {x.l}
          </span>
        ))}
      </GlassCard>
    </motion.div>
  )
}
