import { Activity, Clock, Hospital, Package } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { MapStats } from '../lib/useMapData'

interface StatStripProps {
  stats: MapStats
  loading: boolean
}

export function StatStrip({ stats, loading }: StatStripProps) {
  if (loading) {
    return (
      <div className="pv2-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pv2-skel" style={{ height: 84 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="pv2-stats">
      <div className="pv2-stat">
        <div className="pv2-stat__label">
          <Hospital className="pv2-stat__ico" style={{ color: '#2563eb' }} />
          Hospitales activos
        </div>
        <div className="pv2-stat__value">{stats.hospitalsActive}</div>
        <div className="pv2-stat__hint">Reportando en tiempo real</div>
      </div>

      <div className="pv2-stat">
        <div className="pv2-stat__label">
          <Package className="pv2-stat__ico" style={{ color: '#059669' }} />
          Centros de acopio
        </div>
        <div className="pv2-stat__value">{stats.supplyCenters}</div>
        <div className="pv2-stat__hint">Puntos de recepción</div>
      </div>

      <div className="pv2-stat">
        <div className="pv2-stat__label">
          <Activity className="pv2-stat__ico" style={{ color: '#dc2626' }} />
          Necesidades críticas
        </div>
        <div className="pv2-stat__value" style={{ color: stats.criticalNeeds ? '#dc2626' : undefined }}>
          {stats.criticalNeeds}
        </div>
        <div className="pv2-stat__hint">Requieren atención inmediata</div>
      </div>

      <div className="pv2-stat">
        <div className="pv2-stat__label">
          <Clock className="pv2-stat__ico" style={{ color: '#6b7686' }} />
          Última actualización
        </div>
        <div className="pv2-stat__value pv2-stat__value--sm">
          {stats.lastUpdated ? timeAgo(stats.lastUpdated) : '—'}
        </div>
        <div className="pv2-stat__hint">Datos verificados en sitio</div>
      </div>
    </div>
  )
}
