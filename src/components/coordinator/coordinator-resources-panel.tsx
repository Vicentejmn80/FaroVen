import { useCenterResources, useUpdateCenterResource } from '@/hooks/useCenterOperations'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import type { RegisterSiteType } from '@/repositories/types'
import { useState } from 'react'

const RESOURCE_LABELS: Record<string, string> = {
  water: 'Agua',
  medicine: 'Medicina',
  food: 'Alimentos',
  beds: 'Camas',
  personnel: 'Personal',
}

const RESOURCE_UNITS: Record<string, string> = {
  water: 'litros',
  medicine: 'unidades',
  food: 'raciones',
  beds: 'camas',
  personnel: 'personas',
}

const RESOURCE_ICONS: Record<string, string> = {
  water: '💧',
  medicine: '💊',
  food: '🍲',
  beds: '🛏️',
  personnel: '👥',
}

function ResourceBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  const color =
    pct <= 20
      ? 'bg-critical'
      : pct <= 50
        ? 'bg-warning'
        : pct <= 80
          ? 'bg-info'
          : 'bg-operational'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs font-medium tabular-nums w-10 text-right', pct <= 20 ? 'text-critical' : 'text-ink-subtle')}>
        {pct}%
      </span>
    </div>
  )
}

function ResourceEditor({
  centerId,
  siteType,
  resourceType,
  currentLevel,
  maxLevel,
  onClose,
}: {
  centerId: string
  siteType: RegisterSiteType
  resourceType: string
  currentLevel: number
  maxLevel: number
  onClose: () => void
}) {
  const [current, setCurrent] = useState(currentLevel)
  const [max, setMax] = useState(maxLevel)
  const update = useUpdateCenterResource()

  return (
    <div className="space-y-3 pt-3 border-t border-white/10">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ink-subtle mb-1">Nivel actual</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
            value={current}
            onChange={(e) => setCurrent(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div>
          <label className="block text-xs text-ink-subtle mb-1">Capacidad máxima</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
            value={max}
            onChange={(e) => setMax(Math.max(0, Number(e.target.value)))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <EmergencyButton
          variant="primary"
          size="sm"
          onClick={() =>
            update.mutate(
              {
                centerId,
                siteType,
                resourceType,
                currentLevel: current,
                maxLevel: max,
                unit: RESOURCE_UNITS[resourceType] ?? 'unidades',
              },
              { onSuccess: onClose },
            )
          }
          disabled={update.isPending}
        >
          Guardar
        </EmergencyButton>
        <EmergencyButton variant="glass" size="sm" onClick={onClose}>
          Cancelar
        </EmergencyButton>
      </div>
    </div>
  )
}

export function CoordinatorResourcesPanel() {
  const { assignment } = useCoordinatorAssignment()
  const { data: resources, isLoading } = useCenterResources(assignment?.siteId ?? '')
  const [editing, setEditing] = useState<string | null>(null)
  const siteType = (assignment?.siteType ?? 'hospital') as RegisterSiteType

  if (!assignment) {
    return (
      <div className="p-4 text-center text-sm text-ink-muted">
        No tienes un centro asignado
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} className="h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!resources || resources.length === 0) {
    return (
      <div className="p-4">
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-ink-subtle">No hay recursos registrados para este centro</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-ink mb-2">Recursos del centro</h3>
      {resources.map((r) => (
        <GlassCard key={r.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{RESOURCE_ICONS[r.resourceType] ?? '📦'}</span>
              <span className="text-sm font-medium text-ink">
                {RESOURCE_LABELS[r.resourceType] ?? r.resourceType}
              </span>
            </div>
            <button
              className="text-xs text-ink-subtle hover:text-ink transition-colors"
              onClick={() => setEditing(editing === r.id ? null : r.id)}
            >
              {editing === r.id ? 'Cerrar' : 'Editar'}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-subtle mb-1.5">
            <span>
              {r.currentLevel} / {r.maxLevel} {r.unit}
            </span>
          </div>
          <ResourceBar current={r.currentLevel} max={r.maxLevel} />
          {editing === r.id && (
            <ResourceEditor
              centerId={assignment.siteId}
              siteType={siteType}
              resourceType={r.resourceType}
              currentLevel={r.currentLevel}
              maxLevel={r.maxLevel}
              onClose={() => setEditing(null)}
            />
          )}
        </GlassCard>
      ))}
    </div>
  )
}
