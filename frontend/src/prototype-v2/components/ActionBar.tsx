import { HandHeart, HeartHandshake, MapPinned, PackageSearch, Flag } from 'lucide-react'

export type MapFilter = 'all' | 'help' | 'centers' | 'donate'

interface ActionBarProps {
  filter: MapFilter
  onFilter: (filter: MapFilter) => void
  onShowNeeds: () => void
  reportHref: string
}

export function ActionBar({ filter, onFilter, onShowNeeds, reportHref }: ActionBarProps) {
  const toggle = (next: MapFilter) => onFilter(filter === next ? 'all' : next)

  return (
    <div className="pv2-actions">
      <button
        className={`pv2-chip ${filter === 'help' ? 'pv2-chip--active' : ''}`}
        onClick={() => toggle('help')}
      >
        <HandHeart className="pv2-chip__ico" />
        Quiero ayudar
      </button>

      <button
        className={`pv2-chip ${filter === 'centers' ? 'pv2-chip--active' : ''}`}
        onClick={() => toggle('centers')}
      >
        <MapPinned className="pv2-chip__ico" />
        Encontrar un centro
      </button>

      <button className="pv2-chip" onClick={onShowNeeds}>
        <PackageSearch className="pv2-chip__ico" />
        Ver necesidades
      </button>

      <button
        className={`pv2-chip ${filter === 'donate' ? 'pv2-chip--active' : ''}`}
        onClick={() => toggle('donate')}
      >
        <HeartHandshake className="pv2-chip__ico" />
        Quiero donar
      </button>

      <a className="pv2-chip" href={reportHref} target="_blank" rel="noreferrer">
        <Flag className="pv2-chip__ico" />
        Reportar cambios
      </a>
    </div>
  )
}
