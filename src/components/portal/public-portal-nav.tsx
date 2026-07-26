import { BookOpen, FileText, HelpCircle, Home, Map } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicPortalTab } from '@/data/portal/public-portal-content'

const TABS: Array<{ id: PublicPortalTab; label: string; shortLabel: string; icon: LucideIcon }> = [
  { id: 'home', label: 'Inicio', shortLabel: 'Inicio', icon: Home },
  { id: 'map', label: 'Mapa', shortLabel: 'Mapa', icon: Map },
  { id: 'resources', label: 'Recursos', shortLabel: 'Recursos', icon: BookOpen },
  { id: 'report', label: 'Reportar', shortLabel: 'Reportar', icon: FileText },
  { id: 'guide', label: 'Guía', shortLabel: 'Guía', icon: HelpCircle },
]

interface PublicPortalNavProps {
  active: PublicPortalTab
  onChange: (tab: PublicPortalTab) => void
}

/** Bottom nav en el flujo del layout (móvil) — evita solaparse con el contenido. */
export function PublicPortalNav({ active, onChange }: PublicPortalNavProps) {
  return (
    <nav
      className="relative z-50 w-full shrink-0 border-t border-white/[0.08] bg-[#0B1626]/98 backdrop-blur-md lg:hidden"
      aria-label="Navegación del portal"
    >
      <div className="flex items-stretch justify-between gap-0.5 overflow-x-auto no-scrollbar px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          const isReport = tab.id === 'report'
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              title={tab.label}
              className={cn(
                'tap-target flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] px-0.5 py-2 text-[10px] font-medium transition-colors sm:text-[11px]',
                isActive && !isReport && 'bg-white/[0.08] text-ink',
                !isActive && !isReport && 'text-ink-muted',
                isReport && isActive && 'bg-info/15 text-info',
                isReport && !isActive && 'text-info/80',
              )}
            >
              <Icon className={cn('h-[20px] w-[20px] shrink-0', isReport && 'stroke-[2.25]')} />
              <span className="w-full truncate text-center leading-tight">{tab.shortLabel}</span>
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
    <aside className="sticky top-0 z-30 hidden h-dvh w-[88px] shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#0B1626] py-5 lg:flex">
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-sm font-bold text-info">
        F
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto no-scrollbar">
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
