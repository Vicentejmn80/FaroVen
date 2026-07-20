import { useState } from 'react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { PublicPortalDesktopNav, PublicPortalNav } from '@/components/portal/public-portal-nav'
import { CitizenHome } from '@/components/citizen/citizen-home'
import { CitizenMapView } from '@/components/citizen/citizen-map-view'
import { CitizenResources } from '@/components/citizen/citizen-resources'
import { CitizenReport } from '@/components/citizen/citizen-report'
import { CitizenGuide } from '@/components/citizen/citizen-guide'
import type { PublicPortalTab } from '@/data/portal/public-portal-content'

interface PublicPortalScreenProps {
  onJoinNetwork?: () => void
  onOpenAbout?: () => void
  onOpenHelp?: () => void
}

/**
 * Portal Público FARO — experiencia sin autenticación.
 * Consulta abierta: mapa, centros, recursos, reporte puntual y guía de emergencia.
 * No incluye perfil, notificaciones ni historial personal.
 */
export function PublicPortalScreen({
  onJoinNetwork,
}: PublicPortalScreenProps) {
  const [tab, setTab] = useState<PublicPortalTab>('home')

  const handleReportDone = () => setTab('home')

  return (
    <div className="faro-canvas flex min-h-screen w-full bg-[#0B1626] text-ink lg:flex">
      <PublicPortalDesktopNav active={tab} onChange={setTab} />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col pb-28 lg:pb-10">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#0B1626]/95 px-4 py-3 pt-safe backdrop-blur-sm lg:px-8">
          <FaroIcon size={40} title="FARO" />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold tracking-tight text-ink">FARO</p>
            <p className="truncate text-xs text-ink-muted">Información humanitaria confiable</p>
          </div>
          {onJoinNetwork && (
            <button
              type="button"
              onClick={onJoinNetwork}
              className="hidden rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-info/40 hover:text-info sm:inline-flex"
            >
              Unirme a la Red
            </button>
          )}
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          {tab === 'home' && (
            <CitizenHome onNavigate={setTab} onJoinNetwork={onJoinNetwork} />
          )}

          {tab === 'map' && (
            <CitizenMapView
              onReport={() => setTab('report')}
              onViewResources={() => setTab('resources')}
            />
          )}

          {tab === 'resources' && (
            <CitizenResources onJoinNetwork={onJoinNetwork} />
          )}

          {tab === 'report' && (
            <div className="flex-1 overflow-y-auto">
              <CitizenReport onDone={handleReportDone} />
            </div>
          )}

          {tab === 'guide' && (
            <div className="flex-1 overflow-y-auto">
              <CitizenGuide />
            </div>
          )}
        </main>
      </div>

      <PublicPortalNav active={tab} onChange={setTab} />
    </div>
  )
}
