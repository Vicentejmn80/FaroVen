import { GlassCard } from '@/components/ui/glass-card'
import { useCentersWithStock } from '@/hooks/useCenterOperations'
import { useCenters } from '@/hooks/useCenters'
import { getResourceLabel, listSelectableResources } from '@/lib/resource-catalog'
import { useMemo, useState } from 'react'

/**
 * Lookup liviano para Gestor de Casos / FARO Logistics.
 * Consulta qué centros tienen stock de un recurso del catálogo.
 */
export function CenterStockLookup({
  initialResource,
  className,
}: {
  initialResource?: string
  className?: string
}) {
  const [resourceType, setResourceType] = useState(initialResource ?? 'agua')
  const { data = [], isLoading, isError } = useCentersWithStock(resourceType, 1)
  const { data: centers = [] } = useCenters()

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of centers) map.set(c.id, c.name)
    return map
  }, [centers])

  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] text-ink-subtle">Buscar recurso disponible</label>
      <select
        className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-ink"
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value)}
      >
        {listSelectableResources().map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>

      {isLoading && <p className="text-xs text-ink-faint">Buscando centros…</p>}
      {isError && <p className="text-xs text-critical">No se pudo consultar el inventario.</p>}
      {!isLoading && !isError && data.length === 0 && (
        <GlassCard className="p-3 text-xs text-ink-muted">
          Ningún centro reporta {getResourceLabel(resourceType)} disponible.
        </GlassCard>
      )}
      <div className="space-y-2">
        {data.map((row) => (
          <GlassCard key={`${row.centerId}-${row.resourceType}`} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {nameById.get(row.centerId) ?? row.centerId}
              </p>
              <p className="text-[11px] text-ink-faint">{getResourceLabel(row.resourceType)}</p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-operational">
              {row.quantity} {row.unit}
            </p>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
