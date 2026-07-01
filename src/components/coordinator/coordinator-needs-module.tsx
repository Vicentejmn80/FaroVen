import { useState } from 'react'
import { CheckCircle2, Pencil } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useCoordinatorNeeds } from '@/hooks/useCoordinatorPanel'
import { useCoordinatorMutations } from '@/hooks/useCoordinatorMutations'
import { cn } from '@/lib/utils'
import type { Need } from '@/domain/models'
import { PRIORITY_OPTIONS } from '@/lib/site-utils'

interface CoordinatorNeedsModuleProps {
  onCreateNeed: () => void
}

export function CoordinatorNeedsModule({ onCreateNeed }: CoordinatorNeedsModuleProps) {
  const needs = useCoordinatorNeeds()
  const { markCovered } = useCoordinatorMutations()
  const [editing, setEditing] = useState<Need | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Necesidades del centro</p>
        <EmergencyButton variant="primary" size="sm" onClick={onCreateNeed}>
          Crear necesidad
        </EmergencyButton>
      </div>

      {needs.length === 0 ? (
        <GlassCard className="text-sm text-ink-muted">
          No hay necesidades registradas. Crea la primera para que los ciudadanos vean qué falta.
        </GlassCard>
      ) : (
        needs.map((need) => {
          const coverage = Math.round((need.available / Math.max(need.required, 1)) * 100)
          const covered = need.available >= need.required && need.required > 0
          return (
            <GlassCard key={need.id} className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{need.type}</p>
                  <p className="text-xs text-ink-subtle">
                    {need.available}/{need.required} · Prioridad {priorityLabel(need.priority)}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-xs font-medium',
                    covered ? 'text-operational' : coverage < 40 ? 'text-critical' : 'text-warning',
                  )}
                >
                  {coverage}% cubierto
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    covered ? 'bg-operational' : coverage < 40 ? 'bg-critical' : 'bg-warning',
                  )}
                  style={{ width: `${Math.min(100, coverage)}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <EmergencyButton variant="glass" size="sm" onClick={() => setEditing(need)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </EmergencyButton>
                {!covered && (
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    disabled={markCovered.isPending}
                    onClick={() => markCovered.mutate(need.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Marcar cubierta
                  </EmergencyButton>
                )}
              </div>
            </GlassCard>
          )
        })
      )}

      {editing && (
        <NeedEditSheet need={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function priorityLabel(priority: Need['priority']) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? priority
}

function NeedEditSheet({ need, onClose }: { need: Need; onClose: () => void }) {
  const { updateNeed } = useCoordinatorMutations()
  const [itemName, setItemName] = useState(need.type)
  const [priority, setPriority] = useState(need.priority)
  const [qtyRequired, setQtyRequired] = useState(String(need.required))
  const [qtyReceived, setQtyReceived] = useState(String(need.available))
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    try {
      await updateNeed.mutateAsync({
        id: need.id,
        itemName,
        priority,
        qtyRequired: Number(qtyRequired),
        qtyReceived: Number(qtyReceived),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <GlassCard className="w-full max-w-md space-y-3">
        <p className="text-base font-semibold text-ink">Editar necesidad</p>
        <input
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/60"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <select
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Need['priority'])}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-base-900">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none"
            value={qtyRequired}
            onChange={(e) => setQtyRequired(e.target.value)}
            placeholder="Requerido"
          />
          <input
            type="number"
            min={0}
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none"
            value={qtyReceived}
            onChange={(e) => setQtyReceived(e.target.value)}
            placeholder="Disponible"
          />
        </div>
        {error && <p className="text-sm text-critical">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <EmergencyButton variant="glass" size="md" onClick={onClose}>
            Cancelar
          </EmergencyButton>
          <EmergencyButton variant="primary" size="md" disabled={updateNeed.isPending} onClick={handleSave}>
            Guardar
          </EmergencyButton>
        </div>
      </GlassCard>
    </div>
  )
}
