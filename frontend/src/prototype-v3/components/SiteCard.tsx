import { getGoogleMapsLink, getFreshnessLevel, FRESHNESS_LABELS, timeAgo } from '@/lib/utils'
import { PRIORITY_LABELS } from '@/lib/types'
import { SEVERITY_LABEL, type SiteCardData, type Severity } from '../lib/useSiteCards'

const BAR_COLOR: Record<Severity, string> = {
  critical: '#e36c6c',
  high: '#f1b75c',
  medium: '#e7cf6e',
  covered: '#7bc67f',
}

interface SiteCardProps {
  site: SiteCardData
  onReport: (site: SiteCardData) => void
  onShareDone: (msg: string) => void
}

export function SiteCard({ site, onReport, onShareDone }: SiteCardProps) {
  const freshness = getFreshnessLevel(site.updatedAt)
  const mapHref = getGoogleMapsLink({
    name: site.name,
    address: site.address,
    latitude: site.coords?.lat ?? null,
    longitude: site.coords?.lng ?? null,
  })

  const shareText = [
    `FaroVen · ${site.name}`,
    site.address ? `Ubicación: ${site.address}` : null,
    `Estado: ${SEVERITY_LABEL[site.severity]}`,
    ...site.needs.map((n) => `- ${n.name}: ${n.qtyReceived}/${n.qtyRequired} ${n.unit} (${n.pct}%)`),
    site.notAccepts.length ? `No llevar: ${site.notAccepts.join(', ')}` : null,
    `Actualizado ${timeAgo(site.updatedAt)}`,
  ]
    .filter(Boolean)
    .join('\n')

  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  return (
    <article className="pv3-card">
      <div className="pv3-card__top">
        <div>
          <h3>{site.name}</h3>
          {site.address && <div className="pv3-sub">{site.address}</div>}
        </div>
        <span className={`pv3-badge pv3-badge--${site.severity}`}>{SEVERITY_LABEL[site.severity]}</span>
      </div>

      {site.needs.length === 0 ? (
        <div className="pv3-sub">Sin necesidades activas registradas.</div>
      ) : (
        site.needs.map((need) => (
          <div className="pv3-item" key={need.id}>
            <div className="pv3-item__line">
              <span>
                {need.name} — {need.qtyReceived}/{need.qtyRequired} {need.unit}
              </span>
              <strong>{need.severity === 'covered' ? 'OK' : PRIORITY_LABELS[need.priority].toUpperCase()}</strong>
            </div>
            <div className="pv3-bar">
              <span style={{ width: `${Math.min(100, need.pct)}%`, background: BAR_COLOR[need.severity] }} />
            </div>
          </div>
        ))
      )}

      <div className="pv3-sub" style={{ marginTop: 8 }}>
        Última actualización: {timeAgo(site.updatedAt)}
      </div>

      {freshness !== 'fresh' && (
        <div className="pv3-warn">{FRESHNESS_LABELS[freshness]}</div>
      )}

      {site.notAccepts.length > 0 && (
        <div className="pv3-nollevar">
          <strong>No llevar:</strong> {site.notAccepts.join(', ')} — el coordinador reporta exceso.
        </div>
      )}

      <div className="pv3-card-actions">
        <button className="pv3-btn pv3-btn--primary" onClick={() => onReport(site)}>
          Reportar un cambio
        </button>
        {mapHref ? (
          <a className="pv3-btn" href={mapHref} target="_blank" rel="noopener noreferrer">
            Abrir en Google Maps
          </a>
        ) : (
          <button className="pv3-btn" disabled>
            Sin ubicación
          </button>
        )}
        <a
          className="pv3-btn"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onShareDone('Compartiendo por WhatsApp…')}
        >
          Compartir
        </a>
      </div>
    </article>
  )
}
