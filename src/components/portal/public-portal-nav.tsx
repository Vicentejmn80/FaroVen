import { BookOpen, FileText, HelpCircle, Home, Map } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicPortalTab } from '@/data/portal/public-portal-content'

const TABS: Array<{ id: PublicPortalTab; label: string; icon: LucideIcon }> = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'resources', label: 'Recursos', icon: BookOpen },
  { id: 'report', label: 'Reportar', icon: FileText },
  { id: 'guide', label: 'Guía', icon: HelpCircle },
]

interface PublicPortalNavProps {
  active: PublicPortalTab
  onChange: (tab: PublicPortalTab) => void
}

/** Bottom nav fija en mobile/tablet — no roba ancho. */
export function PublicPortalNav({ active, onChange }: PublicPortalNavProps) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 w-full pb-safe lg:hidden">
      <div className="pointer-events-auto mx-3 mb-3 flex items-stretch justify-between rounded-[18px] border border-white/[0.08] bg-[#12233A]/95 px-1.5 py-1.5 backdrop-blur-md">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          const isReport = tab.id === 'report'
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'tap-target flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-2 text-[11px] font-medium transition-colors',
                isActive && !isReport && 'bg-white/[0.08] text-ink',
                !isActive && !isReport && 'text-ink-muted',
                isReport && isActive && 'bg-info/15 text-info',
                isReport && !isActive && 'text-info/80',
              )}
            >
              <Icon className={cn('h-[22px] w-[22px]', isReport && 'stroke-[2.25]')} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Rail lateral sticky en desktop (≥1024px). */
export function PublicPortalDesktopNav({ active, onChange }: PublicPortalNavProps) {
  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-[88px] shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#0B1626] py-5 lg:flex">
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-sm font-bold text-info">
        F
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex w-[68px] flex-col items-center gap-1 rounded-[14px] px-2 py-2.5 text-[10px] font-medium transition-colors',
                isActive ? 'bg-white/[0.06] text-ink' : 'text-ink-muted hover:text-ink',
                tab.id === 'report' && (isActive ? 'text-info' : 'text-info/80'),
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
