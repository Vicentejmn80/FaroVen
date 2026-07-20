import { useState } from 'react'
import { useUpdateCenterCapacity, useCenterProfile } from '@/hooks/useCenterOperations'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { OPERATIONAL_MODE_LABELS } from '@/domain/center-operations.types'
import type { RegisterSiteType } from '@/repositories/types'

export function CoordinatorCapacityEditor() {
  const { assignment } = useCoordinatorAssignment()
  const siteType = (assignment?.siteType ?? 'hospital') as RegisterSiteType
  const { data: profile, isLoading } = useCenterProfile(assignment?.siteId ?? '', siteType)
  const updateCapacity = useUpdateCenterCapacity()

  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [adults, setAdults] = useState(0)
  const [children, setChildren] = useState(0)
  const [elderly, setElderly] = useState(0)
  const [disabled, setDisabled] = useState(0)
  const [editing, setEditing] = useState(false)

  if (!assignment) {
    return (
      <div className="p-4 text-center text-sm text-ink-muted">
        No tienes un centro asignado
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <GlassCard className="h-32 animate-pulse" />
      </div>
    )
  }

  const handleEdit = () => {
    setCurrent(0)
    setTotal(0)
    setAdults(0)
    setChildren(0)
    setElderly(0)
    setDisabled(0)
    setEditing(true)
  }

  const handleSave = () => {
    updateCapacity.mutate({
      centerId: assignment.siteId,
      siteType,
      update: {
        centerId: assignment.siteId,
        current,
        total,
        occupancyDetail: { adults, children, elderly, disabledMobility: disabled },
      },
    })
    setEditing(false)
  }

  return (
    <div className="p-4">
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">Capacidad del centro</h3>
          {!editing && (
            <EmergencyButton variant="glass" size="sm" onClick={handleEdit}>
              Actualizar
            </EmergencyButton>
          )}
        </div>

        {profile && (
          <div className="space-y-3 mb-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-ink-subtle">Ocupación</span>
                <span className={profile.occupancyPct >= 90 ? 'text-critical font-semibold' : 'text-ink'}>
                  {profile.occupancyPct}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    profile.occupancyPct >= 90
                      ? 'bg-critical'
                      : profile.occupancyPct >= 75
                        ? 'bg-warning'
                        : 'bg-operational'
                  }`}
                  style={{ width: `${profile.occupancyPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 rounded-lg p-2">
                <span className="text-ink-faint">Modo</span>
                <p className="text-ink font-medium">
                  {OPERATIONAL_MODE_LABELS[profile.operationalMode] ?? profile.operationalMode}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <span className="text-ink-faint">Casos activos</span>
                <p className="text-ink font-medium">{profile.activeCaseCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <span className="text-ink-faint">Cobertura de recursos</span>
                <p className="text-ink font-medium">{profile.resourceCoveragePct}%</p>
              </div>
            </div>
          </div>
        )}

        {editing && (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-subtle mb-1">Personas actuales</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
                  value={current}
                  onChange={(e) => setCurrent(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-subtle mb-1">Capacidad total</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
                  value={total}
                  onChange={(e) => setTotal(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>

            <p className="text-xs text-ink-subtle">Desglose de ocupación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-faint mb-1">Adultos</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-faint mb-1">Niños</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-faint mb-1">Adultos mayores</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
                  value={elderly}
                  onChange={(e) => setElderly(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-faint mb-1">Disc. movilidad</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
                  value={disabled}
                  onChange={(e) => setDisabled(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <EmergencyButton
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={updateCapacity.isPending}
              >
                {updateCapacity.isPending ? 'Guardando...' : 'Guardar'}
              </EmergencyButton>
              <EmergencyButton variant="glass" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </EmergencyButton>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
