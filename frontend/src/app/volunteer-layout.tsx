import { Outlet } from 'react-router-dom'
import { VolunteerGuard } from '@/components/volunteer/volunteer-guard'
import { CoordinatorSiteGuard } from '@/components/volunteer/coordinator-site-guard'
import { VolunteerShell } from '@/components/volunteer/volunteer-shell'
import { VolunteerNav } from '@/components/volunteer/volunteer-nav'
import { useLocation } from 'react-router-dom'

export function VolunteerLayout() {
  const location = useLocation()
  const isSetup = location.pathname === '/volunteer/sitio'

  return (
    <VolunteerGuard>
      <CoordinatorSiteGuard>
        <div className="max-w-3xl mx-auto">
          <VolunteerShell />
          {!isSetup && <VolunteerNav />}
          <Outlet />
        </div>
      </CoordinatorSiteGuard>
    </VolunteerGuard>
  )
}
