import { useMemo, useState } from 'react'
import { ExternalLink, Info, MapPin } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { timeAgo } from '@/lib/utils'
import { TopBar, type ViewId } from './components/TopBar'
import { StatStrip } from './components/StatStrip'
import { ActionBar, type MapFilter } from './components/ActionBar'
import { MapCanvas } from './components/MapCanvas'
import { Legend } from './components/Legend'
import { SidePanel } from './components/SidePanel'
import { AiSummary } from './components/AiSummary'
import { ActivityFeed } from './components/ActivityFeed'
import { useMapData, type MapEntity } from './lib/useMapData'
import { buildDailySummary } from './lib/summary'
import { KIND_EMOJI, KIND_LABEL, PRIORITY_COLOR, PRIORITY_LABEL } from './lib/theme'

function PlaceCard({ entity, onOpen }: { entity: MapEntity; onOpen: (e: MapEntity) => void }) {
  return (
    <div className="pv2-place" onClick={() => onOpen(entity)}>
      <div className="pv2-place__row" style={{ justifyContent: 'space-between' }}>
        <span className={`pv2-tag pv2-tag--${entity.kind}`}>
          {KIND_EMOJI[entity.kind]} {KIND_LABEL[entity.kind]}
        </span>
        {entity.topPriority && (
          <span
            className="pv2-tag"
            style={{
              color: PRIORITY_COLOR[entity.topPriority],
              borderColor: PRIORITY_COLOR[entity.topPriority] + '55',
            }}
          >
            {PRIORITY_LABEL[entity.topPriority]}
          </span>
        )}
      </div>
      <div className="pv2-place__name">{entity.name}</div>
      {entity.address && (
        <div className="pv2-place__meta">
          <MapPin size={13} /> {entity.address}
        </div>
      )}
      {entity.needs.length > 0 ? (
        <div className="pv2-place__meta">
          {entity.needs.length} {entity.needs.length === 1 ? 'necesidad' : 'necesidades'} ·{' '}
          {entity.needs.slice(0, 2).map((n) => n.item).join(', ')}
          {entity.needs.length > 2 ? '…' : ''}
        </div>
      ) : (
        <div className="pv2-place__meta">Sin necesidades activas</div>
      )}
      <div className="pv2-place__meta" style={{ color: '#9aa3b2' }}>
        Actualizado {timeAgo(entity.updatedAt)}
      </div>
    </div>
  )
}

export function PrototypeApp() {
  const [view, setView] = useState<ViewId>('map')
  const [filter, setFilter] = useState<MapFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { entities, mapped, unlocated, stats, isLoading, error } = useMapData()
  const summary = useMemo(() => buildDailySummary(entities), [entities])

  const filteredForMap = useMemo(() => {
    switch (filter) {
      case 'help':
        return mapped.filter((e) =>
          e.needs.some((n) => (n.priority === 'critical' || n.priority === 'high') && n.pct < 100)
        )
      case 'centers':
        return mapped.filter((e) => e.kind === 'supply_center')
      case 'donate':
        return mapped.filter((e) => e.kind === 'supply_center' || e.kind === 'shelter')
      default:
        return mapped
    }
  }, [mapped, filter])

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedId) ?? null,
    [entities, selectedId]
  )

  const openOnMap = (entity: MapEntity) => {
    setSelectedId(entity.id)
    setView('map')
  }

  const entitiesWithNeeds = useMemo(
    () =>
      [...entities]
        .filter((e) => e.needs.length > 0)
        .sort((a, b) => b.unmetCritical - a.unmetCritical || b.needs.length - a.needs.length),
    [entities]
  )

  return (
    <div className="pv2-app">
      <TopBar view={view} onNavigate={setView} lastUpdated={stats.lastUpdated} />

      <main className="pv2-main">
        <StatStrip stats={stats} loading={isLoading} />

        {error && (
          <div className="pv2-banner" style={{ color: '#dc2626', background: '#fef2f2', borderColor: '#fbd5d5' }}>
            No se pudieron cargar los datos. Verifica las variables de Supabase.
          </div>
        )}

        {view === 'map' && (
          <>
            <ActionBar
              filter={filter}
              onFilter={setFilter}
              onShowNeeds={() => setView('needs')}
              reportHref="/report"
            />

            <div className="pv2-ops">
              <div className="pv2-mapwrap">
                <div className="pv2-mapbadge">
                  {filteredForMap.length} {filteredForMap.length === 1 ? 'punto' : 'puntos'} en el mapa
                  {filter !== 'all' ? ' · filtrado' : ''}
                </div>
                <MapCanvas
                  entities={filteredForMap}
                  selectedId={selectedId}
                  onSelect={(e) => setSelectedId(e.id)}
                />
                <Legend />
                {selectedEntity && (
                  <SidePanel entity={selectedEntity} onClose={() => setSelectedId(null)} />
                )}
              </div>

              <div className="pv2-rail">
                <AiSummary summary={summary} loading={isLoading} />
                <ActivityFeed limit={6} />
              </div>
            </div>

            {unlocated.length > 0 && (
              <p style={{ fontSize: 12, color: '#9aa3b2', margin: '2px 2px 0' }}>
                {unlocated.length}{' '}
                {unlocated.length === 1 ? 'sitio aún sin ubicación' : 'sitios aún sin ubicación'} en el
                mapa (sin coordenadas ni dirección reconocida). Aparecen en las vistas de lista.
              </p>
            )}
          </>
        )}

        {view === 'activity' && (
          <div className="pv2-view" style={{ maxWidth: 640 }}>
            <ActivityFeed limit={20} />
          </div>
        )}

        {view === 'needs' && (
          <div className="pv2-view">
            <AiSummary summary={summary} loading={isLoading} />
            {entitiesWithNeeds.length === 0 ? (
              <div className="pv2-empty">No hay necesidades activas en este momento.</div>
            ) : (
              <div className="pv2-grid-cards">
                {entitiesWithNeeds.map((e) => (
                  <PlaceCard key={e.id} entity={e} onOpen={openOnMap} />
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'centers' && (
          <div className="pv2-view">
            <div className="pv2-banner">
              <Info size={15} /> Toca cualquier sitio para verlo en el mapa con su ubicación de Google
              Maps.
            </div>
            <div className="pv2-grid-cards">
              {entities.map((e) => (
                <PlaceCard key={e.id} entity={e} onOpen={openOnMap} />
              ))}
            </div>
          </div>
        )}

        {view === 'about' && (
          <div className="pv2-view">
            <div className="pv2-about">
              <h2>{APP_NAME} · Centro de Operaciones</h2>
              <p>
                Esta es una propuesta visual (v2) que reorganiza la misma información verificada de{' '}
                {APP_NAME} alrededor de un mapa en tiempo real. El objetivo es que cualquier persona
                entienda de un vistazo dónde se necesita ayuda, qué hace falta y cómo llegar.
              </p>
              <p>Pensada como un centro de operaciones humanitarias, prioriza acciones sobre módulos:</p>
              <ul>
                <li>Ver el panorama completo en el mapa.</li>
                <li>Encontrar el centro de acopio más cercano.</li>
                <li>Saber qué insumos son críticos hoy.</li>
                <li>Abrir cualquier sitio directo en Google Maps.</li>
              </ul>
              <p style={{ color: '#9aa3b2', fontSize: 13 }}>
                Reutiliza los mismos datos y lógica de la aplicación principal. No reemplaza ninguna
                pantalla existente; convive con la versión actual para poder compararlas.
              </p>
              <a className="pv2-btn pv2-btn--primary" href="/" style={{ width: 'fit-content' }}>
                <ExternalLink size={16} /> Ir a la versión actual
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
