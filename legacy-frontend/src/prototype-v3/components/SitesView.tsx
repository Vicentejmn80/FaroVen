import { useMemo, useState } from 'react'
import { getFreshnessLevel } from '@/lib/utils'
import { SiteCard } from './SiteCard'
import { SectionGuide } from './SectionGuide'
import { ViewHint } from './ViewHint'
import { getNavHint } from '../lib/nav-config'
import { KIND_LABEL, SEVERITY_RANK, type SiteCardData, type SiteKind } from '../lib/useSiteCards'

type SiteFilter = 'all' | 'critical' | 'high' | 'recent'

const FILTERS: { id: SiteFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'critical', label: 'Crítico' },
  { id: 'high', label: 'Alto o peor' },
  { id: 'recent', label: 'Actualizado hace poco' },
]

interface SitesViewProps {
  kind: SiteKind
  sites: SiteCardData[]
  isLoading: boolean
  onReport: (site: SiteCardData) => void
  notify: (msg: string) => void
  onBack: () => void
}

export function SitesView({ kind, sites, isLoading, onReport, notify, onBack }: SitesViewProps) {
  const [filter, setFilter] = useState<SiteFilter>('all')

  const list = useMemo(() => {
    let result = sites.filter((s) => s.kind === kind)
    if (filter === 'critical') result = result.filter((s) => s.severity === 'critical')
    if (filter === 'high') result = result.filter((s) => s.severity === 'critical' || s.severity === 'high')
    if (filter === 'recent') result = result.filter((s) => getFreshnessLevel(s.updatedAt) === 'fresh')

    return [...result].sort((a, b) => {
      const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (r !== 0) return r
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [sites, kind, filter])

  return (
    <section>
      <div className="pv3-view-header">
        <div>
          <h2 className="pv3-view-title">{KIND_LABEL[kind]}</h2>
          <ViewHint>{getNavHint('sites')}</ViewHint>
        </div>
        <button className="pv3-btn" onClick={onBack}>
          Volver a inicio
        </button>
      </div>

      <SectionGuide id="sites">
        Usa los filtros para priorizar: <strong>Crítico</strong> (urgente),{' '}
        <strong>Alto o peor</strong> (incluye crítico), o <strong>Actualizado hace poco</strong>.
        Las insignias de color indican severidad — rojo es lo más urgente; verde significa buena cobertura.
      </SectionGuide>

      <div className="pv3-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`pv3-chip ${filter === f.id ? 'is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="pv3-empty">Cargando sitios…</div>
      ) : list.length === 0 ? (
        <div className="pv3-empty">No hay sitios para este filtro.</div>
      ) : (
        <div className="pv3-cards">
          {list.map((site) => (
            <SiteCard key={site.id} site={site} onReport={onReport} onShareDone={notify} />
          ))}
        </div>
      )}
    </section>
  )
}
