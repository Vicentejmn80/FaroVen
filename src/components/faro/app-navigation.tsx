import { motion } from 'framer-motion'
import { Activity, FileText, Map, Plus, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TabId = 'map' | 'reports' | 'activity' | 'profile' | 'ops'

export const CITIZEN_TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'map', label: 'Situación', icon: Map },
  { id: 'reports', label: 'Reportes', icon: FileText },
  { id: 'activity', label: 'Guía', icon: Activity },
  { id: 'profile', label: 'Perfil', icon: User },
]

export const COORDINATOR_TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'ops', label: 'Panel', icon: Activity },
  { id: 'map', label: 'Centros', icon: Map },
  { id: 'activity', label: 'Guía', icon: FileText },
  { id: 'profile', label: 'Perfil', icon: User },
]

interface NavigationProps {
  active: TabId
  onChange: (tab: TabId) => void
  onCreate?: () => void
  tabs: { id: TabId; label: string; icon: LucideIcon }[]
  createLabel?: string
}

/** Mobile — barra inferior en zona del pulgar */
export function BottomNavigation({ active, onChange, onCreate, tabs, createLabel = 'Acciones' }: NavigationProps) {
  const left = tabs.slice(0, 2)
  const right = tabs.slice(2)

  return (
    <nav className="pointer-events-none absolute bottom-0 left-0 right-0 z-50 w-full pb-safe lg:hidden">
      <div className="glass-strong pointer-events-auto mx-4 mb-3 flex items-center justify-between rounded-full px-3 py-2 shadow-glass">
        <div className="flex flex-1 justify-around">
          {left.map((t) => (
            <NavButton key={t.id} {...t} active={active === t.id} onClick={() => onChange(t.id)} compact />
          ))}
        </div>

        <motion.button
          type="button"
          onClick={onCreate}
          disabled={!onCreate}
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          aria-label={createLabel}
          className={cn(
            'mx-2 flex h-14 w-14 shrink-0 -translate-y-3 items-center justify-center rounded-full bg-info text-white shadow-focal ring-4 ring-base-900',
            !onCreate && 'opacity-40',
          )}
        >
          <Plus className="h-6 w-6" strokeWidth={2.25} />
        </motion.button>

        <div className="flex flex-1 justify-around">
          {right.map((t) => (
            <NavButton key={t.id} {...t} active={active === t.id} onClick={() => onChange(t.id)} compact />
          ))}
        </div>
      </div>
    </nav>
  )
}

/** Desktop — rail lateral, aspecto de consola operativa */
export function DesktopNavigation({ active, onChange, onCreate, tabs, createLabel = 'Acciones' }: NavigationProps) {
  return (
    <aside className="hidden w-[88px] shrink-0 flex-col items-center border-r border-white/[0.06] bg-base-800/50 py-5 lg:flex">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-2xl bg-info/20">
        <span className="relative h-3 w-3 rounded-full bg-info shadow-focal" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {tabs.map((t) => (
          <NavButton
            key={t.id}
            {...t}
            active={active === t.id}
            onClick={() => onChange(t.id)}
            rail
          />
        ))}
      </nav>

      <motion.button
        type="button"
        onClick={onCreate}
        disabled={!onCreate}
        whileTap={{ scale: 0.94 }}
        aria-label={createLabel}
        className={cn(
          'mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-info text-white shadow-focal',
          !onCreate && 'opacity-40',
        )}
      >
        <Plus className="h-5 w-5" strokeWidth={2.25} />
      </motion.button>
    </aside>
  )
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
  compact,
  rail,
}: {
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
  compact?: boolean
  rail?: boolean
}) {
  if (rail) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        title={label}
        className={cn(
          'flex w-[68px] flex-col items-center gap-1 rounded-2xl px-2 py-2.5 transition-colors',
          active ? 'bg-white/[0.08] text-ink' : 'text-ink-faint hover:bg-white/[0.04] hover:text-ink-muted',
        )}
      >
        <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.25 : 1.75} />
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 min-w-[48px] flex-col items-center justify-center gap-0.5 focus-visible:outline-none"
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className={cn(compact ? 'h-[22px] w-[22px]' : 'h-[22px] w-[22px]', active ? 'text-ink' : 'text-ink-faint')}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className={cn('text-[10px] font-medium transition-colors', active ? 'text-ink' : 'text-ink-faint')}>
        {label}
      </span>
    </button>
  )
}
