import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/app/layout'
import { VolunteerLayout } from '@/app/volunteer-layout'
import { HomePage } from '@/pages/Home'
import { ConsultarPage } from '@/pages/Consultar'
import { SearchPage } from '@/pages/Search'
import { HospitalsPage } from '@/pages/Hospitals'
import { SheltersPage } from '@/pages/Shelters'
import { SupplyCentersPage } from '@/pages/SupplyCenters'
import { NeedsPage } from '@/pages/Needs'
import { ReportPage } from '@/pages/Report'
import { AuthPage } from '@/pages/Auth'
import { LinksPage } from '@/pages/Links'
import { VolunteerHubPage } from '@/pages/Volunteer/Hub'
import { VolunteerBulletinPage } from '@/pages/Volunteer/Bulletin'
import { VolunteerQuickUpdatePage } from '@/pages/Volunteer/QuickUpdate'
import { VolunteerSiteSetupPage } from '@/pages/Volunteer/SiteSetup'
import { VolunteerSaturationPage } from '@/pages/Volunteer/Saturation'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/consultar" element={<ConsultarPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/hospitals" element={<HospitalsPage />} />
        <Route path="/shelters" element={<SheltersPage />} />
        <Route path="/supply-centers" element={<SupplyCentersPage />} />
        <Route path="/needs" element={<NeedsPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/auth" element={<AuthPage />} />

        <Route path="/volunteer" element={<VolunteerLayout />}>
          <Route index element={<VolunteerHubPage />} />
          <Route path="sitio" element={<VolunteerSiteSetupPage />} />
          <Route path="actualizar" element={<VolunteerQuickUpdatePage />} />
          <Route path="saturacion" element={<VolunteerSaturationPage />} />
          <Route path="boletin" element={<VolunteerBulletinPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
