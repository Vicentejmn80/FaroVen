import { useEffect, useState } from 'react'
import { useSearch } from '@/hooks/useSearch'
import { useCreateReport } from '@/hooks/useReport'
import { CONFIDENCE_LABELS, STATUS_LABELS, type PersonSearchResult } from '@/lib/types'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { SectionGuide } from './SectionGuide'
import { ViewHint } from './ViewHint'
import { getNavHint } from '../lib/nav-config'

const CONFIDENCE_CLASS = {
  high: 'pv3-badge--high-conf',
  medium: 'pv3-badge--medium-conf',
  low: 'pv3-badge--low-conf',
} as const

function splitName(query: string): { first_name?: string; last_name?: string } {
  const parts = query.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { first_name: parts[0] }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

interface PeopleSearchProps {
  notify: (msg: string) => void
  onBack: () => void
}

export function PeopleSearch({ notify, onBack }: PeopleSearchProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [showMissing, setShowMissing] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const params = splitName(debounced)
  const { data, isFetching, isError } = useSearch(params)
  const createReport = useCreateReport()

  const hasQuery = debounced.trim().length >= 2
  const results = (data ?? []) as PersonSearchResult[]
  const noResults = hasQuery && !isFetching && results.length === 0

  useEffect(() => {
    setShowMissing(false)
  }, [debounced])

  const [missing, setMissing] = useState({ name: '', lastSeen: '', contact: '', notes: '' })

  const submitMissing = (e: React.FormEvent) => {
    e.preventDefault()
    const description = [
      `Reporte de persona desaparecida: ${missing.name || query}`,
      missing.lastSeen ? `Último lugar visto: ${missing.lastSeen}` : null,
      missing.notes ? `Detalles: ${missing.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    createReport.mutate(
      { type: 'other', description, reported_by: 'Ciudadano', contact_info: missing.contact || undefined },
      {
        onSuccess: () => {
          notify('Reporte enviado. Quedará pendiente de verificación.')
          setShowMissing(false)
          setMissing({ name: '', lastSeen: '', contact: '', notes: '' })
        },
        onError: () => notify('No se pudo enviar el reporte. Intenta de nuevo.'),
      }
    )
  }

  return (
    <section>
      <div className="pv3-view-header">
        <div>
          <h2 className="pv3-view-title">Buscar una persona</h2>
          <ViewHint>{getNavHint('people')}</ViewHint>
        </div>
        <button className="pv3-btn" onClick={onBack}>
          Volver a inicio
        </button>
      </div>

      <SectionGuide id="people">
        Esta información proviene de listas publicadas por hospitales y refugios verificados. Puede no estar
        completa. Cada resultado muestra su <strong>nivel de confianza</strong> y la fuente. Si no encuentras
        a alguien, puedes reportarlo como desaparecido al final de la búsqueda.
      </SectionGuide>

      <label htmlFor="pv3-person">Nombre</label>
      <input
        id="pv3-person"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ej. María González"
      />

      <div className="pv3-results" style={{ marginTop: 12 }}>
        {!hasQuery && <div className="pv3-empty">Escribe al menos 2 letras para buscar.</div>}
        {isError && <div className="pv3-banner">No se pudo realizar la búsqueda. Revisa la conexión.</div>}
        {hasQuery && isFetching && <div className="pv3-empty">Buscando…</div>}

        {noResults && (
          <div className="pv3-empty">
            No encontramos coincidencias para <strong>{query}</strong>.
            <div style={{ marginTop: 10 }}>
              <button className="pv3-btn pv3-btn--primary" onClick={() => setShowMissing(true)}>
                Reportar como desaparecido
              </button>
            </div>
          </div>
        )}

        {results.map((p) => {
          const location = p.hospital_name || p.shelter_name || 'Ubicación no especificada'
          return (
            <article className="pv3-card" key={p.id}>
              <div style={{ fontWeight: 700 }}>
                {p.first_name} {p.last_name}
              </div>
              <div className="pv3-sub">{location}</div>
              <div className="pv3-meta-row">
                <span className="pv3-status-line">{STATUS_LABELS[p.status]}</span>
                <span className={`pv3-badge ${CONFIDENCE_CLASS[p.confidence]}`}>
                  Confianza {CONFIDENCE_LABELS[p.confidence]}
                </span>
              </div>
              <div className="pv3-sub" style={{ marginTop: 6 }}>
                {p.source_name ? `Fuente: ${p.source_name} · ` : ''}Actualizado {formatDate(p.updated_at)}
              </div>
              {p.notes && <div className="pv3-sub" style={{ marginTop: 4 }}>{p.notes}</div>}
            </article>
          )
        })}
      </div>

      {showMissing && (
        <form className="pv3-form" style={{ marginTop: 14 }} onSubmit={submitMissing}>
          <h3 style={{ margin: '0 0 8px' }}>Reportar como desaparecido</h3>
          <div className="pv3-pill-note">
            El reporte entra como <strong>pendiente de verificación</strong>; un coordinador lo revisa antes
            de publicarse. No se publica automáticamente.
          </div>
          <label htmlFor="pv3-mname">Nombre completo</label>
          <input
            id="pv3-mname"
            required
            value={missing.name}
            onChange={(e) => setMissing({ ...missing, name: e.target.value })}
            placeholder={query}
          />
          <label htmlFor="pv3-mseen">Último lugar visto</label>
          <input
            id="pv3-mseen"
            required
            value={missing.lastSeen}
            onChange={(e) => setMissing({ ...missing, lastSeen: e.target.value })}
            placeholder="Ej. Plaza Venezuela, 3:30 PM"
          />
          <label htmlFor="pv3-mcontact">Contacto familiar (teléfono o WhatsApp)</label>
          <input
            id="pv3-mcontact"
            required
            value={missing.contact}
            onChange={(e) => setMissing({ ...missing, contact: e.target.value })}
          />
          <label htmlFor="pv3-mnotes">Detalles adicionales (opcional)</label>
          <textarea
            id="pv3-mnotes"
            value={missing.notes}
            onChange={(e) => setMissing({ ...missing, notes: e.target.value })}
          />
          <button className="pv3-btn pv3-btn--primary" type="submit" disabled={createReport.isPending} style={{ marginTop: 10 }}>
            {createReport.isPending ? 'Enviando…' : 'Enviar reporte de desaparición'}
          </button>
        </form>
      )}
    </section>
  )
}
