import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const items = [
  { to: '/volunteer', label: 'Inicio', end: true },
  { to: '/volunteer/actualizar', label: 'Necesidades' },
  { to: '/volunteer/saturacion', label: 'Saturación' },
  { to: '/volunteer/sitio?edit=1', label: 'Mi sitio' },
  { to: '/volunteer/boletin', label: 'Boletín' },
]

export function VolunteerNav() {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-border">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'shrink-0 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors',
              isActive
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
