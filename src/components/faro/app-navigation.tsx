import { motion } from 'framer-motion'
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Handshake,
  HeartHandshake,
  Inbox,
  Map,
  Plus,
  Settings2,
  Shield,
  User,
  Users,
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
 * GC: case-manager | map | applications | success | profile
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
  | 'applications'
  | 'success'
  | 'admin'
  | 'system'

export interface NavTab {
  id: TabId
  label: string
  icon: LucideIcon
  badge?: number
}

const CITIZEN_BASE: NavTab[] = [
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'activity', label: 'Recursos', icon: BookOpen },
  { id: 'reports', label: 'Reportar', icon: FileText },
  { id: 'profile', label: 'Perfil', icon: User },
]

/** Navegación voluntario — Mi Centro de Misiones. */
const VOLUNTEER_TABS: NavTab[] = [
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'needs', label: 'Misiones', icon: HeartHandshake },
  { id: 'collaborations', label: 'Historial', icon: Handshake },
  { id: 'profile', label: 'Perfil', icon: User },
]

/** Gestor: 4 vistas operativas + perfil. Sin Reportar. */
const CASE_MANAGER_TABS: NavTab[] = [
  { id: 'case-manager', label: 'Bandeja', icon: Inbox },
  { id: 'map', label: 'Operaciones', icon: ClipboardCheck },
  { id: 'applications', label: 'Postulaciones', icon: Users },
  { id: 'success', label: 'Éxito', icon: CheckCircle2 },
  { id: 'profile', label: 'Perfil', icon: User },
]

function isVolunteerRole(role: FaroRole): boolean {
  return role === FARO_ROLES.VOLUNTEER
}

function isCaseManagerRole(role: FaroRole): boolean {
  return role === FARO_ROLES.CASE_MANAGER
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

  if (isCaseManagerRole(role)) {
    const tabs = [...CASE_MANAGER_TABS]
    if (canAccessAdminPanel(role)) {
      tabs.push({ id: 'admin', label: 'Administración', icon: Shield })
    }
    if (canAccessSystemPanel(role, email)) {
      tabs.push({ id: 'system', label: 'Sistema', icon: Settings2 })
    }
    return tabs
  }

  const tabs = [...CITIZEN_BASE]

  if (canAccessCoordinatorPanel(role)) {
    tabs.splice(1, 0, { id: 'ops', label: 'Mi Centro', icon: Building2 })
  }

  if (canAccessCaseManagerPanel(role) && role !== FARO_ROLES.CASE_MANAGER) {
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

/** Tabs primarios móviles según rol (máx. 5 + FAB para GC). */
export function getMobilePrimaryTabs(role: FaroRole, email?: string | null): NavTab[] {
  if (isVolunteerRole(role)) return getNavigationTabs(role, email).slice(0, 4)

  if (isCaseManagerRole(role)) {
    // Bandeja | Operaciones | Postulaciones | Éxito — Perfil en rail / 5º si cabe
    return CASE_MANAGER_TABS.slice(0, 5)
  }

  const tabs = getNavigationTabs(role, email)
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

/** Mobile — barra inferior en el flujo del layout (evita saltos de 100vh / URL bar) */
export function BottomNavigation({
  active,
  onChange,
  onCreate,
  createLabel = 'Acciones',
  mobileTabs = CITIZEN_BASE,
}: Omit<NavigationProps, 'tabs'> & { mobileTabs?: NavTab[] }) {
  const primary = mobileTabs.slice(0, 5)
  const leftCount = Math.min(2, Math.ceil(primary.length / 2))
  const left = primary.slice(0, leftCount)
  const right = primary.slice(leftCount)
  const activeView = normalizeTabId(active) ?? active

  return (
    <nav
      className="relative z-50 w-full shrink-0 lg:hidden"
      aria-label="Navegación principal"
    >
      <div className="border-t border-white/[0.1] bg-[#060b16]/98 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
        <div className="flex w-full items-end justify-between gap-0.5 overflow-x-auto no-scrollbar px-1 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <div className="flex min-w-0 flex-1 justify-around">
            {left.map((t) => (
              <NavButton
                key={t.id}
                {...t}
                label={shortMobileLabel(t)}
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
              'relative mx-1 mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-[52px] sm:w-[52px]',
              'bg-gradient-to-b from-[#3d9bff] to-[#0a84ff] text-white',
              'shadow-[0_4px_20px_rgba(10,132,255,0.45)] ring-2 ring-[#060b16]',
              !onCreate && 'pointer-events-none invisible',
            )}
          >
            <Plus className="h-6 w-6" strokeWidth={2.25} />
          </motion.button>

          <div className="flex min-w-0 flex-1 justify-around">
            {right.map((t) => (
              <NavButton
                key={t.id}
                {...t}
                label={shortMobileLabel(t)}
                active={activeView === t.id}
                onClick={() => onChange(t.id)}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}

function shortMobileLabel(tab: NavTab): string {
  switch (tab.id) {
    case 'needs':
      return 'Misiones'
    case 'collaborations':
      return 'Historial'
    case 'activity':
      return 'Guía'
    case 'case-manager':
      return 'Bandeja'
    case 'map':
      return tab.label === 'Operaciones' ? 'Ops' : 'Mapa'
    case 'applications':
      return 'Postula'
    case 'success':
      return 'Éxito'
    case 'reports':
      return 'Reportar'
    default:
      return tab.label
  }
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
  badge,
}: {
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
  compact?: boolean
  rail?: boolean
  badge?: number
}) {
  if (rail) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        title={label}
        className={cn(
          'relative flex w-[68px] flex-col items-center gap-1 rounded-2xl px-2 py-2.5 transition-colors',
          active
            ? 'bg-white/[0.12] text-ink ring-1 ring-white/[0.08]'
            : 'text-ink-faint hover:bg-white/[0.04] hover:text-ink-muted',
        )}
      >
        <span className="relative">
          <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.25 : 1.75} />
          {badge != null && badge > 0 && (
            <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-[52px] min-w-0 max-w-[4.75rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 sm:max-w-none sm:min-w-[56px] sm:px-1',
        active && 'bg-white/[0.08]',
      )}
      aria-current={active ? 'page' : undefined}
      title={label}
    >
      <span className="relative">
        <Icon
          className={cn('h-[21px] w-[21px]', active ? 'text-info' : 'text-ink-muted')}
          strokeWidth={active ? 2.25 : 1.75}
        />
        {badge != null && badge > 0 && (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span
        className={cn(
          'w-full truncate text-center text-[10px] font-medium leading-tight transition-colors',
          active ? 'text-info' : 'text-ink-muted',
        )}
      >
        {label}
      </span>
    </button>
  )
}
