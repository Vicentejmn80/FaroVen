import {
  Bell,
  ChevronRight,
  CircleHelp,
  Globe2,
  LogOut,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import {
  FARO_ROLES,
  PROFILE_STATUS_LABELS,
  resolveDisplayRoleLabel,
} from '@/lib/roles'
import { formatBuildVersion } from '@/lib/build-info'
import { resetAllOnboarding } from '@/lib/onboarding-storage'
import { useToast } from '@/store/toast-context'

interface ProfileScreenProps {
  onRequestCoordinatorAccess?: () => void
  onRequestAuth?: () => void
  onOpenNotificationPreferences?: () => void
}

/** Vista Perfil — sesión, rol y acciones operativas. */
export function ProfileScreen({
  onRequestCoordinatorAccess,
  onRequestAuth,
  onOpenNotificationPreferences,
}: ProfileScreenProps) {
  const { user, profile, role, signOut, canAccessSystemPanel } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const { showToast } = useToast()

  const hasCoordinatorAssignment = Boolean(assignment?.siteId)
  const displayRoleLabel = resolveDisplayRoleLabel(profile, hasCoordinatorAssignment)
  const isSuperAdmin = canAccessSystemPanel
  const isCoordinatorWithSite = profile?.role === FARO_ROLES.COORDINATOR && hasCoordinatorAssignment

  const lastLogin = profile?.last_login_at
    ? new Date(profile.last_login_at).toLocaleString('es-VE')
    : '—'

  const lastActivity = assignment
    ? new Date(profile?.updated_at ?? profile?.last_login_at ?? Date.now()).toLocaleString('es-VE')
    : lastLogin

  const handleOpenNotificationPreferences = () => {
    if (onOpenNotificationPreferences) {
      onOpenNotificationPreferences()
      return
    }
    window.dispatchEvent(new CustomEvent('faro:open-notification-preferences'))
  }

  const buildVersion = formatBuildVersion()

  const openHelpCenter = () => {
    window.dispatchEvent(new CustomEvent('faro:open-help-center'))
  }

  const handleResetOnboarding = () => {
    resetAllOnboarding()
    window.dispatchEvent(new CustomEvent('faro:open-onboarding'))
    showToast('Tutoriales reiniciados. Verás las ayudas al visitar cada sección.', 'success')
  }

  return (
    <ScreenScaffold title="Perfil" subtitle={user ? 'Tu cuenta' : 'Acceso ciudadano'}>
      <div className="space-y-5 pt-2">
        <ContextualHelpCard moduleId="profile" />
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]">
              <UserRound className="h-5 w-5 text-ink-muted" />
            </span>
            <div>
              <p className="text-[15px] font-medium text-ink">
                {profile?.full_name || user?.email || 'Visitante'}
              </p>
              <p className="text-sm text-ink-muted">{user?.email ?? 'Sin sesión activa'}</p>
              {profile?.phone && <p className="text-sm text-ink-subtle">{profile.phone}</p>}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info label="Rol" value={displayRoleLabel} />
              <Info label="Alcance" value="Global" icon={Globe2} />
              <Info label="Estado" value={PROFILE_STATUS_LABELS[profile?.status ?? 'active']} />
              <Info label="Último acceso" value={lastLogin} />
            </div>
          )}

          {isCoordinatorWithSite && assignment && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info label="Rol" value={displayRoleLabel} />
                <Info label="Estado" value={PROFILE_STATUS_LABELS[profile?.status ?? 'active']} />
                <Info label="Última actividad" value={lastActivity} className="col-span-2" />
              </div>
              <div className="rounded-2xl border border-info/20 bg-info/10 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-info">Centro asignado</p>
                <p className="text-sm font-medium text-ink">{assignment.siteName}</p>
              </div>
            </div>
          )}

          {!isSuperAdmin && !isCoordinatorWithSite && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info label="Rol" value={displayRoleLabel} />
              <Info label="Estado" value={profile?.status ?? 'Público'} />
              {profile?.organization_name && (
                <Info label="Organización" value={profile.organization_name} className="col-span-2" />
              )}
              <Info label="Último acceso" value={lastLogin} className="col-span-2" />
            </div>
          )}

          {profile?.role === FARO_ROLES.COORDINATOR && !hasCoordinatorAssignment && (
            <p className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Tu cuenta requiere un centro asignado. Contacta al administrador regional.
            </p>
          )}
        </GlassCard>

        {!user && (
          <GlassCard className="space-y-2">
            <p className="text-sm text-ink-muted">
              Como ciudadano puedes usar FARO sin registrarte. Solo necesitas cuenta si deseas administrar un
              centro.
            </p>
            <EmergencyButton variant="primary" size="md" className="w-full" onClick={onRequestAuth}>
              Iniciar sesión operativa
            </EmergencyButton>
          </GlassCard>
        )}

        {user && role === 'public' && (
          <GlassCard className="space-y-2">
            <button
              type="button"
              onClick={onRequestCoordinatorAccess}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                <ShieldCheck className="h-[18px] w-[18px] text-ink-muted" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] text-ink">Solicitar acceso como Coordinador</span>
                <span className="block text-xs text-ink-subtle">Revisión por administrador regional</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </button>
          </GlassCard>
        )}

        {user && (
          <GlassCard className="space-y-2">
            <button
              type="button"
              onClick={handleOpenNotificationPreferences}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                <Bell className="h-[18px] w-[18px] text-ink-muted" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] text-ink">Preferencias de notificaciones</span>
                <span className="block text-xs text-ink-subtle">Alertas, categorías y silencio temporal</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </button>
          </GlassCard>
        )}

        <GlassCard className="space-y-2">
          <button
            type="button"
            onClick={openHelpCenter}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
              <CircleHelp className="h-[18px] w-[18px] text-ink-muted" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] text-ink">¿Cómo funciona FARO?</span>
              <span className="block text-xs text-ink-subtle">Conceptos, prioridades y cobertura</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </button>
          {user && (
            <button
              type="button"
              onClick={handleResetOnboarding}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                <RotateCcw className="h-[18px] w-[18px] text-ink-muted" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] text-ink">Reiniciar tutoriales y ayudas</span>
                <span className="block text-xs text-ink-subtle">Vuelve a ver las guías contextuales</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </button>
          )}
        </GlassCard>

        {user && (
          <EmergencyButton variant="glass" size="lg" className="w-full text-critical" onClick={() => void signOut()}>
            <LogOut className="h-[18px] w-[18px]" /> Cerrar sesión
          </EmergencyButton>
        )}

        {buildVersion && (
          <p className="pt-2 text-center text-xs text-ink-subtle">{buildVersion}</p>
        )}
      </div>
    </ScreenScaffold>
  )
}

function Info({
  label,
  value,
  className,
}: {
  label: string
  value: string
  icon?: typeof Globe2
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 ${className ?? ''}`}>
      <p className="text-[10px] uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  )
}
