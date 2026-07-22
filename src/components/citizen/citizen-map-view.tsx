import { useMemo, useState } from 'react'
import { ArrowRight, ChevronRight, List, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { MapCanvas } from '@/components/faro/map-canvas'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PORTAL_CATEGORIES, PORTAL_DEMO_NEEDS, PORTAL_DEMO_SITES, type PortalCategoryId } from '@/data/portal/public-portal-content'
import { SITE_META } from '@/lib/status-config'
import type { SiteType, Center } from '@/lib/types'
import { cn, isValidCoord, openExternalNavigation } from '@/lib/utils'
import { useFaro } from '@/store/faro-context'
import type { Site } from '@/lib/types'
import { generatePublicSummary, type PublicSummaryMessage } from '@/services/public-summary-engine'
import { CenterPublicSummary } from '@/components/citizen/center-public-summary'
import { useCreateCoverageReservation, usePublicNeeds } from '@/hooks/usePublicNeeds'
import type { PublicNeed } from '@/domain/public-need.types'

/** Superficie sólida sobre el mapa — legible, blur mínimo */
const MAP_SEARCH_SURFACE =
  'border border-white/[0.14] bg-[#0F1828]/95 shadow-[0_4px_24px_rgba(0,0,0,0.38),0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-[6px]'

/** Panel inferior — translúcido, deja respirar el mapa */
const MAP_PANEL_SURFACE =
  'overflow-hidden rounded-2xl border border-white/[0.18] bg-[#0B1626]/70 shadow-[0_-6px_28px_rgba(0,0,0,0.35),0_1px_0_rgba(255,255,255,0.08)_inset] backdrop-blur-[10px]'

interface CitizenMapViewProps {
  onReport: () => void
  onViewResources: () => void
}

export function CitizenMapView({ onReport, onViewResources }: CitizenMapViewProps) {
  const { sites: liveSites, state } = useFaro()
  const { data: publicNeeds = [] } = usePublicNeeds()
  const reserveCoverage = useCreateCoverageReservation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<PortalCategoryId | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [helpNotice, setHelpNotice] = useState<string | null>(null)

  const publicNeedSites = useMemo(() => publicNeeds.map(publicNeedToSite), [publicNeeds])
  const usingPublicNeeds = publicNeedSites.length > 0

  const usingDemo = liveSites.length === 0
  const sites: Site[] = usingPublicNeeds ? publicNeedSites : (usingDemo ? PORTAL_DEMO_SITES : liveSites)

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase()
    const cat = PORTAL_CATEGORIES.find((c) => c.id === category)
    return sites.filter((site) => {
      if (cat?.siteTypes && !cat.siteTypes.includes(site.type)) return false
      if (category === 'soup_kitchen') return false
      if (!q) return true
      return (
        site.name.toLowerCase().includes(q) ||
        site.zone.toLowerCase().includes(q) ||
        SITE_META[site.type as SiteType].label.toLowerCase().includes(q)
      )
    })
  }, [sites, query, category])

  const nearest = useMemo(() => {
    if (!selectedId) return null
    return filteredSites.find((s) => s.id === selectedId) ?? null
  }, [filteredSites, selectedId])

  const nearestAddress = useMemo(() => {
    if (usingPublicNeeds) return null
    if (!nearest) return null
    const center = state.centers.find((c) => c.id === nearest.id)
    return center?.location.address ?? null
  }, [nearest, state.centers, usingPublicNeeds])

  const selectedPublicNeed = useMemo(() => {
    if (!usingPublicNeeds || !selectedId) return null
    return publicNeeds.find((item) => item.id === selectedId) ?? null
  }, [publicNeeds, selectedId, usingPublicNeeds])

  const summaryMessages = useMemo(() => {
    if (!nearest) return []
    if (usingPublicNeeds && selectedPublicNeed) {
      const hoursLeft = Math.max(0, Math.round((selectedPublicNeed.expiresAt.getTime() - Date.now()) / 3600000))
      const messages: PublicSummaryMessage[] = [
        {
          id: 'need-remaining',
          text: `Falta ${selectedPublicNeed.remainingQuantity} ${selectedPublicNeed.unit} por cubrir.`,
          tone: selectedPublicNeed.priority === 'critical' ? 'critical' : 'warning',
        },
        {
          id: 'need-priority',
          text: `Prioridad ${selectedPublicNeed.priority}.`,
          tone: 'neutral',
        },
        {
          id: 'need-expiry',
          text: hoursLeft > 0
            ? `Tiempo restante estimado: ${hoursLeft}h.`
            : 'La necesidad requiere renovación o cierre por el gestor.',
          tone: hoursLeft > 0 ? 'neutral' : 'critical',
        },
      ]
      return messages
    }
    const center: Center | undefined = state.centers.find((c) => c.id === nearest.id)
    const needs = usingDemo
      ? (PORTAL_DEMO_NEEDS[nearest.id] ?? []).map((name) => ({ name }))
      : nearest.needs.map((n) => ({ name: n.item, coverage: n.coverage }))
    return generatePublicSummary({
      status: nearest.status,
      type: nearest.type,
      needs,
      capacity: center?.capacity,
      schedule: center?.schedule,
    })
  }, [nearest, selectedPublicNeed, usingDemo, state.centers, usingPublicNeeds])

  const canNavigate = Boolean(nearest && isValidCoord(nearest.lat, nearest.lng))

  const handleSelect = (site: Site) => {
    setSelectedId(site.id)
  }

  const handleNavigate = () => {
    if (!nearest) return
    openExternalNavigation({
      lat: nearest.lat,
      lng: nearest.lng,
      name: nearest.name,
      address: nearestAddress,
    })
  }

  const handleClosePanel = () => {
    setSelectedId(null)
    setShowList(false)
    setHelpNotice(null)
  }

  const handleHelpIntent = async () => {
    if (!selectedPublicNeed) return
    setHelpNotice(null)
    try {
      await reserveCoverage.mutateAsync({
        publicNeedId: selectedPublicNeed.id,
        collaboratorType: 'citizen',
        collaboratorName: 'Colaborador web',
        quantity: Math.min(Math.max(selectedPublicNeed.remainingQuantity, 1), 10),
      })
      setHelpNotice('Tu intención de ayuda fue registrada. Un gestor confirmará el apoyo.')
    } catch {
      setHelpNotice('No se pudo registrar tu ayuda ahora. Intenta de nuevo en unos segundos.')
    }
  }

  const showCategory = category !== 'soup_kitchen'

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Header and search */}
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col gap-2.5 px-4 pt-safe pb-2 lg:px-6 lg:pt-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted"
            strokeWidth={2.25}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={usingPublicNeeds ? 'Buscar necesidad o zona...' : 'Buscar hospital, refugio o centro...'}
            className={cn(
              'h-[52px] w-full rounded-2xl py-3.5 pl-12 text-[15px] leading-snug text-ink',
              'placeholder:text-ink-muted outline-none transition-[border-color,box-shadow]',
              'focus:border-info/55 focus:shadow-[0_6px_28px_rgba(0,0,0,0.42),0_0_0_3px_rgba(10,132,255,0.14)]',
              MAP_SEARCH_SURFACE,
              query ? 'pr-12' : 'pr-[52px]',
            )}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-label={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
              aria-pressed={showFilters}
              className={cn(
                'absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl transition-colors',
                showFilters
                  ? 'bg-info/15 text-info'
                  : 'text-ink-muted hover:bg-white/[0.06] hover:text-ink',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category chips */}
        {showFilters && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            <Chip label="Todos" active={category === 'all'} onClick={() => setCategory('all')} />
            {PORTAL_CATEGORIES.filter((c) => c.id !== 'soup_kitchen').map((cat) => (
              <Chip
                key={cat.id}
                label={cat.label}
                active={category === cat.id}
                onClick={() => setCategory(cat.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="absolute inset-0">
        {showCategory ? (
          <MapCanvas
            sites={filteredSites}
            activeId={selectedId}
            onSelect={handleSelect}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#0B1626] px-6 text-center text-sm text-ink-muted">
            Comedores comunitarios estarán disponibles en una próxima actualización.
          </div>
        )}
        {usingDemo && (
          <div className="pointer-events-none absolute left-3 top-[7.5rem] rounded-xl border border-white/10 bg-[#0F1828]/90 px-3 py-1.5 text-[11px] font-medium text-ink-muted shadow-sm backdrop-blur-[4px] lg:top-32">
            Vista de ejemplo · datos reales al conectar centros
          </div>
        )}
      </div>

      {/* Bottom sheet card */}
      {nearest && (
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 lg:mx-auto lg:max-w-3xl lg:px-6 lg:pb-6">
          <div className={cn('relative', MAP_PANEL_SURFACE)}>
            <button
              type="button"
              onClick={handleClosePanel}
              aria-label="Cerrar detalle del centro"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-[#0B1626]/90 text-ink-muted shadow-sm transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-ink"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            {/* Toggle list */}
            <button
              type="button"
              onClick={() => setShowList(!showList)}
              className="flex w-full items-center justify-between border-b border-white/[0.08] px-4 py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-white/[0.04]"
            >
              <span className="flex items-center gap-1.5">
                <List className="h-3.5 w-3.5 text-ink-subtle" />
                {showList ? 'Ocultar lista' : 'Ver todos los centros'}
              </span>
              <ChevronRight className={cn('h-3.5 w-3.5 text-ink-subtle transition-transform', showList && 'rotate-90')} />
            </button>

            {showList && (
              <ScrollArea className="max-h-44 border-b border-white/[0.08]">
                {filteredSites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setSelectedId(site.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]',
                      site.id === selectedId && 'bg-white/[0.07]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{site.name}</p>
                      <p className="text-xs text-ink-muted">
                        {SITE_META[site.type as SiteType].label} · {site.zone}
                      </p>
                    </div>
                    <StatusPill status={site.status} />
                  </button>
                ))}
              </ScrollArea>
            )}

            {/* Nearest center detail */}
            <div className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    {usingPublicNeeds ? 'Necesidad activa' : 'Centro más cercano'}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold leading-tight text-ink">{nearest.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    <span className="truncate">
                      {nearest.zone} · {usingPublicNeeds ? 'Necesidad pública' : SITE_META[nearest.type].label}
                    </span>
                  </p>
                </div>
                <StatusPill status={nearest.status} />
              </div>

              {summaryMessages.length > 0 && (
                <div className="mt-3.5">
                  <CenterPublicSummary messages={summaryMessages} />
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  disabled={!canNavigate}
                  onClick={handleNavigate}
                >
                  Cómo llegar
                </EmergencyButton>
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  className="flex-1"
                  onClick={usingPublicNeeds ? handleHelpIntent : onReport}
                  disabled={usingPublicNeeds && reserveCoverage.isPending}
                >
                  {usingPublicNeeds
                    ? (reserveCoverage.isPending ? 'Registrando…' : 'Quiero ayudar')
                    : 'Reportar situación'}
                </EmergencyButton>
              </div>
              {usingPublicNeeds && helpNotice && (
                <p className="mt-2 text-center text-[11px] text-operational">{helpNotice}</p>
              )}
              {!canNavigate && (
                <p className="mt-2 text-center text-[11px] text-warning">
                  {usingPublicNeeds
                    ? 'Esta necesidad aún no tiene coordenadas públicas verificadas.'
                    : 'Este centro aún no tiene coordenadas registradas.'}
                </p>
              )}
            </div>

            {/* View resources link */}
            <button
              type="button"
              onClick={onViewResources}
              className="flex w-full items-center justify-center gap-1.5 border-t border-white/[0.08] px-4 py-3 text-xs font-semibold text-info transition-colors hover:bg-white/[0.03] hover:text-info/90"
            >
              Ver recursos útiles
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
        'shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
        active
          ? 'border-info/45 bg-info/15 text-info'
          : 'border-white/[0.12] bg-[#0F1828]/90 text-ink-muted hover:border-white/20 hover:text-ink-subtle',
      )}
    >
      {label}
    </button>
  )
}

function StatusPill({ status }: { status: Site['status'] }) {
  const open = status === 'operational'
  const saturated = status === 'critical'
  return (
    <span
      className={cn(
        'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold',
        open && 'bg-success/10 text-success',
        saturated && 'bg-critical/10 text-critical',
        !open && !saturated && 'bg-warning/10 text-warning',
      )}
    >
      {open ? 'Abierto' : saturated ? 'Saturado' : 'Atención'}
    </span>
  )
}

function publicNeedToSite(need: PublicNeed): Site {
  const lat = Number(need.locationPublic.lat)
  const lng = Number(need.locationPublic.lng)
  const priorityToStatus: Record<PublicNeed['priority'], Site['status']> = {
    critical: 'critical',
    high: 'warning',
    medium: 'operational',
    low: 'info',
  }

  const required = Math.max(need.requiredQuantity, 1)
  const coverage = Math.max(0, Math.min(100, Math.round((need.coveredQuantity / required) * 100)))

  return {
    id: need.id,
    name: need.title,
    type: 'organization',
    status: priorityToStatus[need.priority] ?? 'info',
    statusLabel: need.status,
    zone: need.locationPublic.zone ?? 'Zona por confirmar',
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    mapX: 0,
    mapY: 0,
    needs: [
      {
        id: need.id,
        item: need.summary || need.category,
        priority: need.priority,
        coverage,
      },
    ],
    updatedAt: need.updatedAt,
    verified: need.verificationStatus === 'approved_entry' || need.verificationStatus === 'approved_exit',
  }
}
