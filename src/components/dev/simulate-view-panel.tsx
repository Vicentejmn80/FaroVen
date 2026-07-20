import { Eye, EyeOff, Monitor } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { SectionHeader } from '@/components/coordinator/section-header'
import { ALL_ROLES, ROLE_LABELS } from '@/services/dev-service'
import type { FaroRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface SimulateViewPanelProps {
  simulatedRole: FaroRole | null
  onSimulate: (role: FaroRole) => void
  onStopSimulation: () => void
}

export function SimulateViewPanel({
  simulatedRole,
  onSimulate,
  onStopSimulation,
}: SimulateViewPanelProps) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Simular Vista"
        subtitle="Visualiza la interfaz de cualquier rol sin modificar la base de datos"
        icon={Eye}
      />

      {simulatedRole && (
        <GlassCard className="border-info/30 bg-info/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-info" />
              <div>
                <p className="text-sm font-medium text-info">Simulación activa</p>
                <p className="text-xs text-ink-subtle">
                  Viendo interfaz de: <strong className="text-ink">{ROLE_LABELS[simulatedRole]}</strong>
                </p>
              </div>
            </div>
            <EmergencyButton variant="glass" size="sm" onClick={onStopSimulation}>
              <EyeOff className="h-3.5 w-3.5" /> Salir
            </EmergencyButton>
          </div>
        </GlassCard>
      )}

      <GlassCard className="space-y-2">
        <p className="text-xs text-ink-subtle">
          Selecciona un rol para ver cómo se ve la interfaz de ese usuario.
          La simulación es solo visual — no modifica permisos reales ni datos en la base de datos.
        </p>
      </GlassCard>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {ALL_ROLES.filter((r) => r !== 'super_admin').map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onSimulate(role)}
            className={cn(
              'glass rounded-3xl p-3 text-left transition-colors hover:bg-white/[0.09]',
              simulatedRole === role && 'ring-2 ring-info/50',
            )}
          >
            <p className="text-sm font-medium text-ink">{ROLE_LABELS[role]}</p>
            <p className="text-xs text-ink-subtle">
              {role === 'public' && 'Vista de ciudadano sin rol'}
              {role === 'volunteer' && 'Vista de voluntario'}
              {role === 'case_manager' && 'Vista de gestor de casos'}
              {role === 'coordinator' && 'Vista de coordinador de centro'}
              {role === 'regional_admin' && 'Vista de administrador regional'}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
