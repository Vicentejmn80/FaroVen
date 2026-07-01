import { APP_NAME } from '@/lib/constants'
import { timeAgo } from '@/lib/utils'

export type ViewId = 'map' | 'activity' | 'needs' | 'centers' | 'about'

const NAV: { id: ViewId; label: string }[] = [
  { id: 'map', label: 'Mapa' },
  { id: 'activity', label: 'Actividad' },
  { id: 'needs', label: 'Necesidades' },
  { id: 'centers', label: 'Centros' },
  { id: 'about', label: 'Acerca de' },
]

interface TopBarProps {
  view: ViewId
  onNavigate: (view: ViewId) => void
  lastUpdated: string | null
}

export function TopBar({ view, onNavigate, lastUpdated }: TopBarProps) {
  return (
    <header className="pv2-topbar">
      <div className="pv2-brand" onClick={() => onNavigate('map')}>
        <span className="pv2-brand__mark">◎</span>
        <span>
          <span className="pv2-brand__name">{APP_NAME}</span>
          <br />
          <span className="pv2-brand__sub">Centro de Operaciones</span>
        </span>
      </div>

      <nav className="pv2-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`pv2-nav__item ${view === item.id ? 'pv2-nav__item--active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pv2-topbar__spacer" />

      <span className="pv2-live">
        <span className="pv2-dot-live" />
        {lastUpdated ? `En vivo · ${timeAgo(lastUpdated)}` : 'En vivo'}
      </span>
    </header>
  )
}
