import { motion } from 'framer-motion'
import {
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  Handshake,
  HeartHandshake,
  Map,
  Plus,
  Settings2,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { cn } from '@/lib/utils'
import {
  canAccessAdminPanel,
  canAccessCaseManagerPanel,
  canAccessCoordinatorPanel,
  canAccessSystemPanel,
  FARO_ROLES,
  type FaroRole,
} from '@/lib/roles'

/**
 * Vistas del shell (navegación manual, sin react-router).
 * Voluntario: map | needs | collaborations | profile
 */
export type TabId =
  | 'map'
  | 'needs'
  | 'collaborations'
  | 'home' // alias legacy → needs
  | 'reports'
  | 'activity'
  | 'profile'
  | 'ops'
  | 'case-manager'
  | 'admin'
  | 'system'

export interface NavTab {
  id: TabId
  label: string
  icon: LucideIcon
}

const CITIZEN_BASE: NavTab[] = [
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'activity', label: 'Recursos', icon: BookOpen },
  { id: 'reports', label: 'Reportar', icon: FileText },
  { id: 'profile', label: 'Perfil', icon: User },
]

/** Navegación voluntario — una vista distinta por ítem. */
const VOLUNTEER_TABS: NavTab[] = [
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'needs', label: 'Necesidades', icon: HeartHandshake },
  { id: 'collaborations', label: 'Colaboraciones', icon: Handshake },
  { id: 'profile', label: 'Perfil', icon: User },
]

function isVolunteerRole(role: FaroRole): boolean {
  return role === FARO_ROLES.VOLUNTEER
}

/** Normaliza aliases legacy (home → needs). */
export function normalizeTabId(tab: TabId | string | null | undefined): TabId | null {
  if (!tab) return null
  if (tab === 'home') return 'needs'
  return tab as TabId
}

/** Tabs completos — rail lateral en desktop */
export function getNavigationTabs(role: FaroRole, email?: string | null): NavTab[] {
  if (isVolunteerRole(role)) {
    return [...VOLUNTEER_TABS]
  }

  const tabs = [...CITIZEN_BASE]

  if (canAccessCoordinatorPanel(role)) {
    tabs.splice(1, 0, { id: 'ops', label: 'Mi Centro', icon: Building2 })
  }

  if (canAccessCaseManagerPanel(role)) {
    tabs.splice(1, 0, { id: 'case-manager', label: 'Gestor', icon: ClipboardCheck })
  }

  if (canAccessAdminPanel(role)) {
    tabs.push({ id: 'admin', label: 'Administración', icon: Shield })
  }

  if (canAccessSystemPanel(role, email)) {
    tabs.push({ id: 'system', label: 'Sistema', icon: Settings2 })
  }

  return tabs
}

/** Tabs primarios móviles según rol (máx. 4 + FAB). */
export function getMobilePrimaryTabs(role: FaroRole, email?: string | null): NavTab[] {
  const tabs = getNavigationTabs(role, email)
  if (isVolunteerRole(role)) return tabs.slice(0, 4)

  const baseIds = new Set(CITIZEN_BASE.map((t) => t.id))
  const primary = tabs.filter((t) => baseIds.has(t.id)).slice(0, 4)
  return primary.length === 4 ? primary : CITIZEN_BASE
}

/** @deprecated Usar getMobilePrimaryTabs(role) */
export const MOBILE_PRIMARY_TABS: NavTab[] = CITIZEN_BASE

/** @deprecated Usar getNavigationTabs(role) */
export const CITIZEN_TABS = CITIZEN_BASE

/** @deprecated Usar getNavigationTabs(role) */
export const COORDINATOR_TABS: NavTab[] = [
  { id: 'ops', label: 'Panel', icon: Building2 },
  { id: 'map', label: 'Centros', icon: Map },
  { id: 'activity', label: 'Recursos', icon: BookOpen },
  { id: 'profile', label: 'Perfil', icon: User },
]

interface NavigationProps {
  active: TabId
  onChange: (tab: TabId) => void
  onCreate?: () => void
  tabs: NavTab[]
  createLabel?: string
  mobileTabs?: NavTab[]
}

/** Mobile — barra inferior en zona del pulgar (siempre 4 tabs + botón central) */
export function BottomNavigation({
  active,
  onChange,
  onCreate,
  createLabel = 'Acciones',
  mobileTabs = CITIZEN_BASE,
}: Omit<NavigationProps, 'tabs'> & { mobileTabs?: NavTab[] }) {
  const primary = mobileTabs.slice(0, 4)
  const left = primary.slice(0, 2)
  const right = primary.slice(2)
  const activeView = normalizeTabId(active) ?? active

  return (
    <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 w-full lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="glass-strong pointer-events-auto flex items-center justify-between border-t border-white/[0.06] px-2 py-2 pb-safe shadow-glass">
        <div className="flex flex-1 justify-around">
          {left.map((t) => (
            <NavButton
              key={t.id}
              {...t}
              active={activeView === t.id}
              onClick={() => onChange(t.id)}
              compact
            />
          ))}
        </div>

        <motion.button
          type="button"
          onClick={onCreate}
          disabled={!onCreate}
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          aria-label={createLabel}
          aria-hidden={!onCreate}
          tabIndex={onCreate ? 0 : -1}
          className={cn(
            'mx-2 flex h-14 w-14 shrink-0 -translate-y-3 items-center justify-center rounded-full bg-info text-white shadow-focal ring-4 ring-base-900',
            !onCreate && 'pointer-events-none invisible',
          )}
        >
          <Plus className="h-6 w-6" strokeWidth={2.25} />
        </motion.button>

        <div className="flex flex-1 justify-around">
          {right.map((t) => (
            <NavButton
              key={t.id}
              {...t}
              active={activeView === t.id}
              onClick={() => onChange(t.id)}
              compact
            />
          ))}
        </div>
      </div>
    </nav>
  )
}

/** Desktop — rail lateral estático */
export function DesktopNavigation({ active, onChange, onCreate, tabs, createLabel = 'Acciones' }: NavigationProps) {
  const activeView = normalizeTabId(active) ?? active

  return (
    <aside className="hidden w-[88px] shrink-0 flex-col items-center border-r border-white/[0.06] bg-base-800/50 py-5 lg:flex">
      <div className="mb-6">
        <FaroIcon size={28} title="FARO" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1" aria-label="Navegación principal">
        {tabs.map((t) => (
          <NavButton
            key={t.id}
            {...t}
            active={activeView === t.id}
            onClick={() => onChange(t.id)}
            rail
          />
        ))}
      </nav>

      {onCreate ? (
        <motion.button
          type="button"
          onClick={onCreate}
          whileTap={{ scale: 0.94 }}
          aria-label={createLabel}
          className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-info text-white shadow-focal"
        >
          <Plus className="h-5 w-5" strokeWidth={2.25} />
        </motion.button>
      ) : (
        <div className="mt-4 h-12 w-12" aria-hidden />
      )}
    </aside>
  )
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
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
          active
            ? 'bg-white/[0.12] text-ink ring-1 ring-white/[0.08]'
            : 'text-ink-faint hover:bg-white/[0.04] hover:text-ink-muted',
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
      className={cn(
        'flex h-12 min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-xl focus-visible:outline-none',
        active && 'bg-white/[0.06]',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className={cn('h-[22px] w-[22px]', active ? 'text-ink' : 'text-ink-faint')}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className={cn('text-[10px] font-medium transition-colors', active ? 'text-ink' : 'text-ink-faint')}>
        {label}
      </span>
    </button>
  )
}
