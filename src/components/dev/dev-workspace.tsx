import { useState } from 'react'
import { FlaskConical, Shield, Heart, Eye, Wrench } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { SectionHeader } from '@/components/coordinator/section-header'
import { RoleLabModule } from './role-lab-module'
import { IntentLabModule } from './intent-lab-module'
import { SimulateViewPanel } from './simulate-view-panel'
import type { FaroRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

type LabModuleId = 'roles' | 'intent' | 'simulate' | 'tools'

const LAB_MODULES: Array<{ id: LabModuleId; label: string; icon: typeof Shield; description: string }> = [
  { id: 'roles', label: 'Cambio de Roles', icon: Shield, description: 'Asignar roles manualmente' },
  { id: 'intent', label: 'Intención de Participación', icon: Heart, description: 'Definir intención del usuario' },
  { id: 'simulate', label: 'Simular Vista', icon: Eye, description: 'Vista previa por rol' },
  { id: 'tools', label: 'Herramientas', icon: Wrench, description: 'Próximamente' },
]

interface DevWorkspaceProps {
  simulatedRole: FaroRole | null
  onSimulate: (role: FaroRole) => void
  onStopSimulation: () => void
}

export function DevWorkspace({
  simulatedRole,
  onSimulate,
  onStopSimulation,
}: DevWorkspaceProps) {
  const [activeModule, setActiveModule] = useState<LabModuleId>('roles')

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Laboratorio FARO"
        subtitle="Herramientas internas de desarrollo y testing"
        icon={FlaskConical}
      />

      <GlassCard className="border-warning/20 bg-warning/5">
        <p className="text-xs text-ink-subtle">
          Este módulo es temporal y será eliminado cuando la plataforma esté terminada.
          Las acciones realizadas aquí afectan datos reales en la base de datos.
        </p>
      </GlassCard>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
        {LAB_MODULES.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activeModule === item.id
                  ? 'border-info/50 bg-info/15 text-ink'
                  : 'border-white/10 bg-white/[0.04] text-ink-subtle hover:bg-white/[0.08]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {activeModule === 'roles' && <RoleLabModule />}
      {activeModule === 'intent' && <IntentLabModule />}
      {activeModule === 'simulate' && (
        <SimulateViewPanel
          simulatedRole={simulatedRole}
          onSimulate={onSimulate}
          onStopSimulation={onStopSimulation}
        />
      )}
      {activeModule === 'tools' && (
        <GlassCard className="py-8 text-center text-sm text-ink-muted">
          Próximamente: generación de datos de prueba, simulación de emergencias, limpieza de datos demo.
        </GlassCard>
      )}
    </div>
  )
}
