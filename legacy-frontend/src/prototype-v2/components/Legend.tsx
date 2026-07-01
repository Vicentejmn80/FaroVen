import { KIND_COLOR, KIND_LABEL } from '../lib/theme'
import type { EntityKind } from '../lib/useMapData'

const KINDS: EntityKind[] = ['hospital', 'supply_center', 'shelter']

export function Legend() {
  return (
    <div className="pv2-legend">
      {KINDS.map((kind) => (
        <div key={kind} className="pv2-legend__row">
          <span className="pv2-legend__swatch" style={{ background: KIND_COLOR[kind] }} />
          {KIND_LABEL[kind]}
        </div>
      ))}
      <div className="pv2-legend__row">
        <span className="pv2-legend__swatch" style={{ background: '#dc2626' }} />
        Necesidad crítica
      </div>
    </div>
  )
}
