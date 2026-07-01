import { NavLink, Outlet } from 'react-router-dom'
import { AdminGuard } from '@/components/admin/admin-guard'
import { APP_NAME } from '@/lib/constants'

const ADMIN_NAV = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/reportes', label: 'Reportes ciudadanos' },
  { to: '/admin/apoyo', label: 'Solicitudes de apoyo' },
]

export function AdminLayout() {
  return (
    <AdminGuard>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">
            {APP_NAME} · Panel de administración
          </p>
          <nav className="flex flex-wrap gap-2">
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <Outlet />
      </div>
    </AdminGuard>
  )
}
