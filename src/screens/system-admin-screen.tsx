import { Shield } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { SuperAdminConsole } from '@/components/admin/super-admin-console'
import { useAuth } from '@/store/auth-context'

interface SystemAdminScreenProps {
  onRequestAuth?: () => void
}

export function SystemAdminScreen({ onRequestAuth }: SystemAdminScreenProps) {
  const { canAccessSystemPanel, loading, user } = useAuth()

  if (loading) {
    return (
      <ScreenScaffold title="Sistema" subtitle="Super administración">
        <p className="pt-4 text-sm text-ink-muted">Verificando permisos…</p>
      </ScreenScaffold>
    )
  }

  if (!canAccessSystemPanel) {
    return (
      <ScreenScaffold title="Sistema" subtitle="Super administración">
        <GlassCard className="mt-4 space-y-3 text-center">
          <Shield className="mx-auto h-8 w-8 text-warning" />
          <p className="text-sm text-ink-muted">
            {!user
              ? 'Inicia sesión con la cuenta de Super Administrador.'
              : 'Tu cuenta no tiene acceso a la consola de sistema.'}
          </p>
          {!user && onRequestAuth && (
            <EmergencyButton variant="primary" size="md" className="w-full" onClick={onRequestAuth}>
              Iniciar sesión
            </EmergencyButton>
          )}
        </GlassCard>
      </ScreenScaffold>
    )
  }

  return (
    <ScreenScaffold title="Sistema" subtitle="Consola Super Admin">
      <div className="space-y-4 pt-2">
        <ContextualHelpCard moduleId="system" />
        <SuperAdminConsole />
      </div>
    </ScreenScaffold>
  )
}
