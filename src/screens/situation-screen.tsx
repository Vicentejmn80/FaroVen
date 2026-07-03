import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PlusCircle } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { SectionTitle } from '@/components/faro/section-title'
import { MapCanvas } from '@/components/faro/map-canvas'
import { SidePanel } from '@/components/faro/side-panel'
import { SituationSummary } from '@/components/faro/situation-summary'
import { TimelineItem } from '@/components/faro/timeline-item'
import { cn, greeting } from '@/lib/utils'
import type { Site } from '@/lib/types'
import { useFaro } from '@/store/faro-context'

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
  const { sites, latestActivity, isLoading, loadError } = useFaro()
  const [selected, setSelected] = useState<Site | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'hospital' | 'shelter' | 'supply_center'>('all')
  const filteredSites = sites.filter((site) => {
    const byType = typeFilter === 'all' ? true : site.type === typeFilter
    const byName = query.trim()
      ? site.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        site.zone.toLowerCase().includes(query.trim().toLowerCase())
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Mobile: scroll único | Desktop: grid sin scroll externo */}
      <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-32 pt-1 lg:overflow-hidden lg:px-8 lg:pb-6 lg:pt-2">
        <div className="lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(380px,42%)] lg:gap-8">
          {/* Columna izquierda — contexto y reportes */}
          <div className="lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:pr-1">
            <PageHeader onRegisterSite={onRegisterSite} />
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
              <GlassCard inset={false} className="mt-4 space-y-3 p-4">
                <p className="text-sm font-medium text-ink">Mapa vacío — datos en vivo desde Supabase</p>
                <p className="text-sm text-ink-muted">
                  No hay sitios activos. Registra el primer hospital, refugio o centro de acopio para que aparezca aquí.
                </p>
                {onRegisterSite && (
                  <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onRegisterSite}>
                    Registrar primer sitio
                  </EmergencyButton>
                )}
              </GlassCard>
            )}

            <section className="mt-4 lg:mt-3">
              <SectionTitle className="lg:hidden">Qué debemos resolver ahora</SectionTitle>
              <div className="mt-2.5 lg:mt-0">
                <SituationSummary sites={filteredSites} className="lg:hidden" />
                <SituationSummary sites={filteredSites} title="Prioridades activas" compact className="hidden lg:block" />
              </div>
            </section>

            {/* Mapa en flujo de scroll — solo mobile/tablet */}
            <section className="mt-5 lg:hidden">
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
          <FaroIcon size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-ink outline-none focus:border-info/60"
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
      <SectionTitle>Reportes recientes</SectionTitle>
      <GlassCard inset={false} className="p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
        <div className="no-scrollbar lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {activity.length ? (
            activity.map((event, i) => (
              <TimelineItem key={event.id} event={event} index={i} last={i === activity.length - 1} />
            ))
          ) : (
            <p className="px-1 py-2 text-sm text-ink-subtle">Sin movimientos recientes.</p>
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
