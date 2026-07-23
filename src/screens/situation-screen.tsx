import { useEffect, useMemo, useRef, useState } from 'react'
import { latLngBounds } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { MapGoogleLinkButton, MapLocateControl, MapZoomControls } from '@/components/faro/map-controls'
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
import { safeFlyTo, safeMapCenter, safeMarkerPosition } from '@/lib/geo'
import { MapSectionErrorBoundary } from '@/components/faro/map-section-error-boundary'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { SITE_TYPE_LABELS, siteToNeedableType } from '@/lib/site-utils'
import { cn, greeting } from '@/lib/utils'
import type { Need } from '@/domain/models'
import type { Site } from '@/lib/types'
import { useFaro } from '@/store/faro-context'
import { useAuth, usePermissions } from '@/store/auth-context'
import { MissionDetailSheet } from '@/components/volunteer/mission-detail-sheet'
import { INCIDENT_TYPE_LABELS, label, PRIORITY_SHORT_LABELS } from '@/lib/labels'
import { useMapData, type Mission } from '@/hooks/useMapData'
import { useCases } from '@/hooks/useCases'

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
  const { data: openCases } = useCases({ stage: 'open_for_applications' })
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
    const openCaseMissions: Mission[] = useMemo(
      () => (openCases ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        requiredSkill: null,
        status: 'open' as const,
        priority: c.priority as 'low' | 'medium' | 'high' | 'critical',
        location: { lat: c.location.lat, lng: c.location.lng },
        createdAt: c.createdAt,
      })),
      [openCases],
    )
    const allMissions = [...mapData.missions, ...openCaseMissions]
    const volunteerMissions = filterMappableMissions(
      normalizeVolunteerMissions(allMissions, mapData.sites, mapData.needs),
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
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* ── Móvil: mapa a pantalla completa ── */}
      <div
        className={cn(
          'absolute inset-0 lg:hidden',
          viewMode === 'list' && 'pointer-events-none invisible',
        )}
      >
        <OperationsMap
          selected={selected}
          onSelect={setSelected}
          sites={filteredSites}
          fullBleed
          className="h-full w-full"
        />

        {/* Controles flotantes: búsqueda + toggle Mapa | Listado */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2">
          <div className="pointer-events-auto space-y-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <MobileMapSearch
                  query={query}
                  onQuery={setQuery}
                  typeFilter={typeFilter}
                  onTypeFilter={setTypeFilter}
                  totalSites={filteredSites.length}
                />
              </div>
              <MobileViewToggle view={viewMode} onChange={setViewMode} />
            </div>
            {loadError && (
              <GlassCard inset={false} className="border-critical/30 bg-critical/10 p-2.5">
                <p className="text-xs text-critical">{loadError}</p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      {/* ── Móvil: listado como capa ── */}
      {viewMode === 'list' && (
        <div className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-base-900">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Vista operativa
              </p>
              <h2 className="text-sm font-semibold text-ink">Centros y necesidades</h2>
            </div>
            <MobileViewToggle view={viewMode} onChange={setViewMode} />
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-nav pt-3">
            <QuickAnswerBar
              query={query}
              onQuery={setQuery}
              typeFilter={typeFilter}
              onTypeFilter={setTypeFilter}
              totalSites={filteredSites.length}
            />
            {!isLoading && !loadError && sites.length === 0 ? (
              <GuidedEmptyState
                className="mt-4"
                icon={MapPin}
                title="Aún no hay centros en el mapa"
                description="Cuando los coordinadores registren hospitales, refugios o acopios, aparecerán aquí."
              />
            ) : (
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
          </div>
        </div>
      )}

      {/* ── Desktop: panel + mapa ── */}
      <div className="hidden h-full min-h-0 overflow-hidden px-8 pb-6 pt-2 lg:block">
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(380px,42%)] gap-8">
          <div className="flex min-h-0 flex-col overflow-y-auto pr-1">
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

            <section className="mt-3">
              <SituationSummary
                sites={filteredSites}
                needs={needs}
                title="Prioridades activas"
                compact
              />
            </section>

            <section className="mt-4">
              <SectionTitle>Vista operativa</SectionTitle>
              <DesktopViewToggle view={viewMode} onChange={setViewMode} />
            </section>

            {viewMode === 'list' && (
              <>
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
                {listSites.length > 0 && (
                  <div className="mt-4">
                    <PriorityCoverageGuide
                      compact
                      className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                    />
                  </div>
                )}
              </>
            )}

            <ReportsSection activity={filteredActivity} className="mt-4 min-h-0 flex-1" />
          </div>

          <section className="flex min-h-0 flex-col">
            <SectionTitle>Mapa de operaciones</SectionTitle>
            <div className="mt-3 min-h-0 flex-1">
              <OperationsMap
                selected={selected}
                onSelect={setSelected}
                sites={filteredSites}
                className="h-full min-h-[480px]"
              />
            </div>
          </section>
        </div>
      </div>

      <SidePanel site={selected} onClose={() => setSelected(null)} onOpenDetail={onOpenDetail} />
    </div>
  )
}

type VolunteerMission = Mission & {
  siteName: string
  zone: string
  distanceKm: string
  description?: string
  affectedPeople?: number | null
  expiresAt?: Date | null
  required?: number | null
  available?: number | null
}

function humanizeMissionTitle(raw: string): string {
  return label(INCIDENT_TYPE_LABELS, raw.trim().toLowerCase(), raw)
}

function buildVolunteerMissions(sites: Site[], needs: Need[]): VolunteerMission[] {
  const siteById = new Map(sites.map((site) => [site.id, site]))
  const activeNeeds = needs.filter((need) => !isCovered(need))
  const results: VolunteerMission[] = []

  for (const [index, need] of activeNeeds.entries()) {
    const site = siteById.get(need.centerId)
    if (!site) continue

    const location = resolveMissionCoordinates(site.lat, site.lng, {
      needId: need.id,
      missionId: need.id,
      title: need.type,
    })
    if (!location) continue

    const distanceKm = (1.2 + (index % 6) * 0.6 + (need.id.charCodeAt(0) % 7) * 0.12).toFixed(1)
    results.push({
      id: need.id,
      title: humanizeMissionTitle(need.type),
      requiredSkill: null,
      status: 'open',
      priority: need.priority === 'critical' ? 'critical' : need.priority === 'high' ? 'high' : 'medium',
      location,
      createdAt: need.updatedAt,
      siteName: site.name,
      zone: site.zone,
      distanceKm,
      description: `Se necesita ${humanizeMissionTitle(need.type).toLowerCase()} en ${site.name}.`,
      affectedPeople: null,
      expiresAt: need.expiresAt ?? null,
      required: need.required,
      available: need.available,
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
      title: humanizeMissionTitle(mission.title),
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
  const [showList, setShowList] = useState(false)
  /** Un solo MapContainer a la vez: dos mapas (móvil hidden + desktop) provocan flyTo en size 0 → NaN LatLng. */
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const visibleMissions = useMemo(() => {
    const maxKm = Number.parseFloat(distanceFilter)
    return missions.filter((m) => {
      const km = Number.parseFloat(m.distanceKm)
      return Number.isFinite(km) ? km <= maxKm : true
    })
  }, [missions, distanceFilter])

  useEffect(() => {
    if (selectedMission && !visibleMissions.some((m) => m.id === selectedMission.id)) {
      setSelectedMission(null)
    }
  }, [visibleMissions, selectedMission])

  const closeDetail = () => setSelectedMission(null)

  const openMission = (mission: VolunteerMission) => {
    if (import.meta.env.DEV) {
      console.info('[FARO] Mission selected', {
        missionId: mission.id,
        title: mission.title,
        hasCoords: resolveMissionCoordinates(mission.location.lat, mission.location.lng) !== null,
      })
    }
    // Detalle independiente del flyTo
    setSelectedMission(mission)
  }

  const mapCanvas = (
    <MapSectionErrorBoundary
      resetKey={`map-${selectedMission?.id ?? 'none'}-${isDesktop ? 'desk' : 'mob'}`}
      title="No pudimos localizar esta necesidad"
      description="Es posible que todavía no tenga una ubicación válida. El detalle sigue disponible."
      onDismiss={closeDetail}
    >
      <VolunteerMapCanvas
        missions={visibleMissions}
        activeId={selectedMission?.id}
        onSelect={openMission}
        fullBleed={!isDesktop}
      />
    </MapSectionErrorBoundary>
  )

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {/* Móvil: mapa full-bleed — solo montar fuera de desktop */}
      {!isDesktop && (
      <div
        className={cn(
          'absolute inset-0',
          showList && 'pointer-events-none invisible',
        )}
      >
        {mapCanvas}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2">
          <div className="pointer-events-auto flex items-start gap-2">
            <div className="glass-strong min-w-0 flex-1 space-y-2 rounded-2xl px-3 py-2.5 shadow-glass-sm ring-1 ring-white/10">
              <p className="text-[11px] font-semibold text-ink">Necesidades cercanas</p>
              <div className="flex flex-wrap gap-1.5">
                {(['5', '10', '25'] as const).map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    onClick={() => setDistanceFilter(radius)}
                    className={
                      distanceFilter === radius
                        ? 'rounded-full border border-info/60 bg-info-soft px-2.5 py-1 text-[10px] text-ink'
                        : 'rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-ink-muted'
                    }
                  >
                    {radius} km
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowList(true)}
              className="glass-strong flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium text-ink shadow-glass-sm ring-1 ring-white/10"
            >
              <List className="h-3.5 w-3.5" />
              Listado
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Móvil: listado */}
      {!isDesktop && showList && (
        <div className="absolute inset-0 z-30 flex flex-col bg-base-900 lg:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Necesidades abiertas</h2>
            <button
              type="button"
              onClick={() => setShowList(false)}
              className="glass-strong flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink shadow-glass-sm ring-1 ring-white/10"
              aria-label="Volver al mapa"
            >
              <MapIcon className="h-3.5 w-3.5" />
              Mapa
            </button>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-nav pt-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <GlassCard key={i} inset={false} className="h-16 animate-pulse" />
                ))}
              </div>
            ) : visibleMissions.length === 0 ? (
              <GuidedEmptyState
                icon={Flag}
                title="No hay necesidades abiertas cerca"
                description="Amplía el radio o vuelve en unos minutos para ver nuevas oportunidades."
              />
            ) : (
              <div className="space-y-2">
                {visibleMissions.map((mission) => (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => {
                      openMission(mission)
                      setShowList(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                      selectedMission?.id === mission.id
                        ? 'border-info/60 bg-info-soft'
                        : 'border-white/[0.06] bg-white/[0.03]',
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                      <Flag className="h-4 w-4 text-info" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <NeedItemLabel name={mission.title} className="text-sm font-semibold text-ink" />
                      <span className="mt-0.5 block text-xs text-ink-subtle">
                        {mission.siteName} · {mission.distanceKm} km ·{' '}
                        {label(PRIORITY_SHORT_LABELS, mission.priority)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop: un solo mapa */}
      {isDesktop && (
      <div className="h-full min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(360px,42%)] gap-6 overflow-hidden px-8 pb-6 pt-2">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <header className="shrink-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {greeting()} · Red de Apoyo
            </p>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">Radar de necesidades</h1>
            <p className="text-sm text-ink-subtle">
              Elige una necesidad cercana, revisa el detalle y ofrece tu ayuda.
            </p>
          </header>

          <section className="mt-3 shrink-0">
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
                {visibleMissions.length} necesidad(es) · radio {distanceFilter} km
              </p>
            </GlassCard>
          </section>

          {loadError && (
            <GlassCard inset={false} className="mt-3 shrink-0 border-critical/30 bg-critical/10 p-3">
              <p className="text-sm text-critical">{loadError}</p>
            </GlassCard>
          )}

          <section className="mt-4 flex min-h-0 flex-1 flex-col">
            <SectionTitle className="shrink-0">Abiertas ahora</SectionTitle>
            {isLoading ? (
              <div className="mt-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <GlassCard key={i} inset={false} className="h-16 animate-pulse" />
                ))}
              </div>
            ) : visibleMissions.length === 0 ? (
              <GuidedEmptyState
                className="mt-3"
                icon={Flag}
                title="No hay necesidades abiertas"
                description="Amplía el radio o vuelve en unos minutos."
              />
            ) : (
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {visibleMissions.map((mission) => (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => openMission(mission)}
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
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="flex min-h-0 flex-col gap-3">
          <div className="map-container-wrapper min-h-0 flex-[1.1]">
            <SectionTitle className="mb-3 shrink-0">Mapa operativo</SectionTitle>
            <div className="h-[calc(100%-1.75rem)] min-h-[280px] overflow-hidden rounded-2xl border border-white/[0.06]">
              {mapCanvas}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.06]">
            <MapSectionErrorBoundary
              resetKey={`panel-${selectedMission?.id ?? 'none'}`}
              onDismiss={closeDetail}
              title="No fue posible cargar la información completa"
              description="Puedes volver a intentarlo o elegir otra necesidad."
            >
              {selectedMission ? (
                <MissionDetailSheet
                  mission={selectedMission}
                  onClose={closeDetail}
                  variant="panel"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-sm text-ink-subtle">Selecciona una necesidad</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      El detalle operacional aparecerá aquí
                    </p>
                  </div>
                </div>
              )}
            </MapSectionErrorBoundary>
          </div>
        </section>
      </div>
      )}

      {/* Móvil: bottom sheet de detalle */}
      {!isDesktop && (
        <div>
          <MapSectionErrorBoundary
            resetKey={`sheet-${selectedMission?.id ?? 'none'}`}
            onDismiss={closeDetail}
            title="No pudimos abrir el detalle"
            description="Esta misión puede no tener ubicación precisa. Intenta de nuevo."
          >
            <MissionDetailSheet mission={selectedMission} onClose={closeDetail} variant="sheet" />
          </MapSectionErrorBoundary>
        </div>
      )}
    </div>
  )
}

function VolunteerMapCanvas({
  missions,
  activeId,
  onSelect,
  fullBleed = false,
}: {
  missions: VolunteerMission[]
  activeId?: string | null
  onSelect: (mission: VolunteerMission) => void
  fullBleed?: boolean
}) {
  const mappableMissions = useMemo(() => filterMappableMissions(missions), [missions])

  const center: [number, number] = useMemo(
    () => safeMapCenter(mappableMissions.map((m) => m.location)),
    [mappableMissions],
  )

  const activeMission = useMemo(
    () => mappableMissions.find((m) => m.id === activeId) ?? null,
    [mappableMissions, activeId],
  )

  return (
    <div
      className={cn(
        'map-container-wrapper relative h-full min-h-[inherit] w-full overflow-hidden bg-base-800/30 touch-none',
        !fullBleed && 'rounded-2xl border border-white/[0.06]',
      )}
    >
      <MapContainer
        className="faro-map !absolute inset-0 h-full w-full"
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
        <MapResizeNotifier />
        <TileLayer
          className="faro-map-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMissionsOnce missions={mappableMissions} />
        <FocusActiveMission missions={mappableMissions} activeId={activeId} />
        <MapZoomControls />
        <MapLocateControl />
        {mappableMissions.map((mission) => {
          const position = safeMarkerPosition(mission.location.lat, mission.location.lng, {
            entityId: mission.id,
            title: mission.title,
          })
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

      {activeMission && (
        <MapGoogleLinkButton
          lat={activeMission.location.lat}
          lng={activeMission.location.lng}
          label={activeMission.title}
          className="bottom-4"
        />
      )}
    </div>
  )
}

function FitToMissionsOnce({ missions }: { missions: VolunteerMission[] }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (fittedRef.current) return
    const coords = missions
      .map((mission) => getMissionLatLng(mission))
      .filter((point): point is [number, number] => point !== null)

    if (!coords.length) return

    try {
      const bounds = latLngBounds(coords)
      if (!bounds.isValid()) return
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 })
      fittedRef.current = true
      requestAnimationFrame(() => {
        try {
          map.invalidateSize({ animate: false })
        } catch {
          /* mapa oculto — ignorar */
        }
      })
    } catch (err) {
      console.warn('[FARO] fitBounds skipped', err)
    }
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
    // Independiente del bottom sheet: solo centra si el mapa es visible y las coords son válidas.
    safeFlyTo(map, mission.location.lat, mission.location.lng, {
      zoom: Math.max(map.getZoom(), 13),
      duration: 0.24,
      context: {
        entityId: mission.id,
        entityType: 'mission',
        title: mission.title,
        action: 'FocusActiveMission',
      },
    })
  }, [activeId, map, missions])

  return null
}

function DesktopViewToggle({
  view,
  onChange,
}: {
  view: 'map' | 'list'
  onChange: (next: 'map' | 'list') => void
}) {
  /** En desktop el mapa ya es columna fija; el toggle solo cambia el panel izquierdo. */
  const options = [
    { id: 'map' as const, label: 'Resumen', icon: MapIcon },
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

/** Toggle flotante Mapa | Listado — dispara vista interactiva completa. */
function MobileViewToggle({
  view,
  onChange,
}: {
  view: 'map' | 'list'
  onChange: (next: 'map' | 'list') => void
}) {
  return (
    <div className="glass-strong flex shrink-0 items-center rounded-full p-0.5 shadow-glass-sm ring-1 ring-white/10">
      <button
        type="button"
        onClick={() => onChange('map')}
        aria-pressed={view === 'map'}
        aria-label="Vista de mapa"
        className={cn(
          'flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
          view === 'map' ? 'bg-info text-white' : 'text-ink-muted',
        )}
      >
        <MapIcon className="h-3.5 w-3.5" />
        Mapa
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        aria-label="Vista de listado"
        className={cn(
          'flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
          view === 'list' ? 'bg-info text-white' : 'text-ink-muted',
        )}
      >
        <List className="h-3.5 w-3.5" />
        Listado
      </button>
    </div>
  )
}

function MobileMapSearch({
  query,
  onQuery,
  typeFilter,
  onTypeFilter,
  totalSites,
}: {
  query: string
  onQuery: (value: string) => void
  typeFilter: 'all' | 'hospital' | 'shelter' | 'supply_center'
  onTypeFilter: (value: 'all' | 'hospital' | 'shelter' | 'supply_center') => void
  totalSites: number
}) {
  const types: Array<{ id: typeof typeFilter; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'hospital', label: 'Hospital' },
    { id: 'shelter', label: 'Refugio' },
    { id: 'supply_center', label: 'Acopio' },
  ]

  return (
    <div className="glass-strong space-y-2 rounded-2xl px-3 py-2.5 shadow-glass-sm ring-1 ring-white/10">
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Buscar centro o zona…"
        className="h-8 w-full rounded-lg border border-white/[0.08] bg-black/20 px-2.5 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-info/40"
      />
      <div className="no-scrollbar -mx-0.5 flex gap-1 overflow-x-auto px-0.5">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTypeFilter(t.id)}
            className={
              typeFilter === t.id
                ? 'shrink-0 rounded-full border border-info/50 bg-info/15 px-2.5 py-1 text-[10px] font-medium text-info'
                : 'shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-ink-muted'
            }
          >
            {t.label}
          </button>
        ))}
        <span className="shrink-0 self-center pl-1 text-[10px] text-ink-faint">{totalSites}</span>
      </div>
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
  fullBleed = false,
}: {
  selected: Site | null
  onSelect: (site: Site | null) => void
  sites: Site[]
  className?: string
  fullBleed?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'relative w-full overflow-hidden',
        !fullBleed && 'rounded-3xl shadow-glass ring-1 ring-inset ring-white/10',
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
        className={cn(
          'absolute flex items-center gap-3 rounded-2xl px-3 py-2',
          fullBleed ? 'bottom-20 left-3 lg:bottom-auto lg:left-3 lg:top-3' : 'left-3 top-3',
        )}
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
