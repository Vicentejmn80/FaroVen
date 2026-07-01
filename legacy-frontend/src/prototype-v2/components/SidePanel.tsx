import { useState } from 'react'
import {
  Clock,
  ExternalLink,
  History,
  MapPin,
  Phone,
  Share2,
  X,
} from 'lucide-react'
import { copyToClipboard, getGoogleMapsLink, timeAgo } from '@/lib/utils'
import type { MapEntity } from '../lib/useMapData'
import {
  KIND_LABEL,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  coverageColor,
} from '../lib/theme'

interface SidePanelProps {
  entity: MapEntity
  onClose: () => void
}

export function SidePanel({ entity, onClose }: SidePanelProps) {
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const mapLink = getGoogleMapsLink({
    name: entity.name,
    address: entity.address,
    latitude: entity.coords?.lat ?? null,
    longitude: entity.coords?.lng ?? null,
  })

  const handleShare = async () => {
    const url = mapLink ?? ''
    const text = `${entity.name} · ${KIND_LABEL[entity.kind]}`
    if (navigator.share && url) {
      try {
        await navigator.share({ title: entity.name, text, url })
        return
      } catch {
        /* el usuario canceló: caemos a copiar */
      }
    }
    const ok = await copyToClipboard(url || text)
    setShareMsg(ok ? 'Enlace copiado al portapapeles' : 'No se pudo copiar')
    setTimeout(() => setShareMsg(null), 2400)
  }

  return (
    <aside className="pv2-panel">
      <div className="pv2-panel__head">
        <div className="pv2-panel__top">
          <div>
            <span className={`pv2-tag pv2-tag--${entity.kind}`}>{KIND_LABEL[entity.kind]}</span>
            <h2 className="pv2-panel__title" style={{ marginTop: 8 }}>
              {entity.name}
            </h2>
          </div>
          <button className="pv2-panel__close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span className={`pv2-tag pv2-tag--${entity.status === 'active' ? 'ok' : ''}`}>
            {entity.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
          {entity.topPriority && (
            <span
              className="pv2-tag"
              style={{
                color: PRIORITY_COLOR[entity.topPriority],
                borderColor: PRIORITY_COLOR[entity.topPriority] + '55',
              }}
            >
              Prioridad {PRIORITY_LABEL[entity.topPriority]}
            </span>
          )}
        </div>
      </div>

      <div className="pv2-panel__body">
        {entity.address && (
          <div className="pv2-kv">
            <MapPin />
            <span>
              {entity.address}
              {entity.referentialCoords && (
                <em style={{ color: '#9aa3b2', fontStyle: 'normal' }}> · ubicación referencial</em>
              )}
            </span>
          </div>
        )}
        <div className="pv2-kv">
          <Clock />
          <span>Actualizado {timeAgo(entity.updatedAt)}</span>
        </div>
        {entity.phone && (
          <div className="pv2-kv">
            <Phone />
            <a href={`tel:${entity.phone}`} style={{ color: 'inherit' }}>
              {entity.phone}
            </a>
          </div>
        )}

        <div>
          <div className="pv2-section-label">
            Necesidades {entity.needs.length ? `(${entity.needs.length})` : ''}
          </div>
          {entity.needs.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6b7686', margin: 0 }}>
              Sin necesidades activas reportadas.
            </p>
          ) : (
            entity.needs.map((need) => (
              <div key={need.id} className="pv2-need">
                <div className="pv2-need__top">
                  <span className="pv2-need__name">{need.item}</span>
                  <span
                    className="pv2-tag"
                    style={{
                      color: PRIORITY_COLOR[need.priority],
                      borderColor: PRIORITY_COLOR[need.priority] + '55',
                      padding: '2px 7px',
                    }}
                  >
                    {PRIORITY_LABEL[need.priority]}
                  </span>
                </div>
                <div className="pv2-bar">
                  <div
                    className="pv2-bar__fill"
                    style={{ width: `${Math.min(need.pct, 100)}%`, background: coverageColor(need.pct) }}
                  />
                </div>
                <div className="pv2-need__detail">
                  {need.detail} · {need.pct}% cubierto
                </div>
              </div>
            ))
          )}
        </div>

        {showHistory && (
          <div className="pv2-banner">
            El historial detallado de cambios estará disponible cuando se conecte el registro de
            auditoría. Por ahora, el dato más reciente es de {timeAgo(entity.updatedAt)}.
          </div>
        )}

        <div className="pv2-panel__actions">
          {mapLink && (
            <a className="pv2-btn pv2-btn--primary" href={mapLink} target="_blank" rel="noreferrer">
              <ExternalLink /> Abrir en Google Maps
            </a>
          )}
          <button className="pv2-btn" onClick={handleShare}>
            <Share2 /> {shareMsg ?? 'Compartir ubicación'}
          </button>
          <button className="pv2-btn pv2-btn--ghost" onClick={() => setShowHistory((v) => !v)}>
            <History /> {showHistory ? 'Ocultar historial' : 'Ver historial'}
          </button>
        </div>
      </div>
    </aside>
  )
}
