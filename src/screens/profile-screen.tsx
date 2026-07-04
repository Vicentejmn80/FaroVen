import {
  Bell,
  ChevronRight,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { FARO_ROLE_LABELS } from '@/lib/roles'
import { formatBuildVersion } from '@/lib/build-info'

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
  const { user, profile, role, signOut } = useAuth()
  const { assignment } = useCoordinatorAssignment()

  const lastLogin = profile?.last_login_at
    ? new Date(profile.last_login_at).toLocaleString('es-VE')
    : '—'

  const handleOpenNotificationPreferences = () => {
    if (onOpenNotificationPreferences) {
      onOpenNotificationPreferences()
      return
    }
    window.dispatchEvent(new CustomEvent('faro:open-notification-preferences'))
  }

  const buildVersion = formatBuildVersion()

  return (
    <ScreenScaffold title="Perfil" subtitle={user ? 'Tu cuenta' : 'Acceso ciudadano'}>
      <div className="space-y-5 pt-2">
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Rol" value={FARO_ROLE_LABELS[role]} />
            <Info label="Estado" value={profile?.status ?? 'Público'} />
            <Info label="Organización" value={profile?.organization_id ? 'Asignada' : '—'} />
            <Info label="Último acceso" value={lastLogin} />
          </div>

          {assignment && (
            <div className="rounded-2xl border border-info/20 bg-info/10 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-info">Centro asignado</p>
              <p className="text-sm font-medium text-ink">{assignment.siteName}</p>
            </div>
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

        {user && (
          <EmergencyButton variant="glass" size="lg" className="w-full text-critical" onClick={() => void signOut()}>
            <LogOut className="h-[18px] w-[18px]" /> Cerrar sesión
          </EmergencyButton>
        )}

        {buildVersion && (
          <p className="pt-2 text-center text-[10px] text-ink-faint">{buildVersion}</p>
        )}
      </div>
    </ScreenScaffold>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  )
}
