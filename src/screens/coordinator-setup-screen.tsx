import { ShieldCheck } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { useMyCoordinatorRequests } from '@/hooks/useAuthRequests'
import { COORDINATOR_REQUEST_STATUS, COORDINATOR_REQUEST_STATUS_LABELS } from '@/lib/roles'

interface CoordinatorSetupScreenProps {
  onRequestAuth?: () => void
  onRequestCoordinatorAccess?: () => void
}

/** Acceso al panel — requiere autenticación y aprobación administrativa. */
export function CoordinatorSetupScreen({
  onRequestAuth,
  onRequestCoordinatorAccess,
}: CoordinatorSetupScreenProps) {
  const { user, role } = useAuth()
  const { data: requests = [] } = useMyCoordinatorRequests()

  const pending = requests.find((r) => r.status === COORDINATOR_REQUEST_STATUS.PENDING)
  const rejected = requests.find((r) => r.status === COORDINATOR_REQUEST_STATUS.REJECTED)

  if (!user) {
    return (
      <ScreenScaffold title="Mi Centro" subtitle="Acceso operativo">
        <GlassCard className="mt-2 space-y-3">
          <p className="text-sm text-ink-muted">
            Para administrar un centro necesitas iniciar sesión y que un administrador apruebe tu acceso.
          </p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onRequestAuth}>
            Iniciar sesión
          </EmergencyButton>
        </GlassCard>
      </ScreenScaffold>
    )
  }

  if (role !== 'coordinator') {
    return (
      <ScreenScaffold title="Mi Centro" subtitle="Acceso operativo">
        <GlassCard className="mt-2 space-y-3">
          <ShieldCheck className="h-6 w-6 text-info" />
          {pending ? (
            <p className="text-sm text-ink-muted">
              Tu solicitud está {COORDINATOR_REQUEST_STATUS_LABELS[pending.status].toLowerCase()}. Un
              administrador regional la revisará pronto.
            </p>
          ) : rejected ? (
            <p className="text-sm text-ink-muted">
              Tu solicitud fue rechazada. Puedes enviar una nueva solicitud con información actualizada.
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              Aún no tienes permisos de coordinador. Solicita acceso y espera la aprobación de un
              administrador regional.
            </p>
          )}
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onRequestCoordinatorAccess}>
            Solicitar acceso como Coordinador
          </EmergencyButton>
        </GlassCard>
      </ScreenScaffold>
    )
  }

  return (
    <ScreenScaffold title="Mi Centro" subtitle="Acceso operativo">
      <GlassCard className="mt-2 text-sm text-ink-muted">
        Tu cuenta está aprobada pero aún no hay un centro asignado. Contacta a un administrador regional.
      </GlassCard>
    </ScreenScaffold>
  )
}
