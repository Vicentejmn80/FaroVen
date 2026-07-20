import { AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { ROLE_LABELS } from '@/services/dev-service'
import type { FaroRole } from '@/lib/roles'

interface RoleConfirmationDialogProps {
  userName: string
  currentRole: FaroRole | null
  newRole: FaroRole
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function RoleConfirmationDialog({
  userName,
  currentRole,
  newRole,
  onConfirm,
  onCancel,
  loading,
}: RoleConfirmationDialogProps) {
  const isCoordinator = newRole === 'coordinator'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <GlassCard className="w-full max-w-md space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning/15">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">Confirmar cambio de rol</p>
            <p className="mt-1 text-sm text-ink-subtle">
              ¿Seguro que deseas convertir a <strong className="text-ink">{userName}</strong> en{' '}
              <strong className="text-ink">{ROLE_LABELS[newRole]}</strong>?
            </p>
            {currentRole && (
              <p className="mt-1 text-xs text-ink-faint">
                Rol actual: {ROLE_LABELS[currentRole]}
              </p>
            )}
          </div>
        </div>

        {isCoordinator && (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3">
            <p className="text-sm text-ink">
              Los coordinadores requieren un centro asignado para operar correctamente.
              Actualmente solo puedes asignar centros desde el módulo de Coordinadores
              del panel de administración.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <EmergencyButton
            variant="glass"
            size="md"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </EmergencyButton>
          <EmergencyButton
            variant="primary"
            size="md"
            className="flex-1"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Aplicando...' : 'Confirmar'}
          </EmergencyButton>
        </div>
      </GlassCard>
    </div>
  )
}
