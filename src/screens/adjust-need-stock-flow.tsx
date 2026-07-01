import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { FlowSheet, FormField, fieldClassName } from '@/components/faro/flow-sheet'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAdjustNeedStock } from '@/hooks/useFaroMutations'
import { useFaro } from '@/store/faro-context'

interface AdjustNeedStockFlowProps {
  onClose: () => void
  mode: 'arrival' | 'dispatch'
  presetSiteId?: string
}

export function AdjustNeedStockFlow({ onClose, mode, presetSiteId }: AdjustNeedStockFlowProps) {
  const { sites, state } = useFaro()
  const mutation = useAdjustNeedStock()
  const [siteId, setSiteId] = useState(presetSiteId ?? sites[0]?.id ?? '')
  const [needId, setNeedId] = useState('')
  const [quantity, setQuantity] = useState('10')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsBySite = useMemo(
    () =>
      state.needs
        .filter((need) => need.centerId === siteId)
        .sort((a, b) => {
          if (a.priority === b.priority) return b.updatedAt.getTime() - a.updatedAt.getTime()
          return a.priority === 'critical' ? -1 : b.priority === 'critical' ? 1 : 0
        }),
    [siteId, state.needs],
  )

  const selectedNeed = useMemo(
    () => needsBySite.find((need) => need.id === needId) ?? needsBySite[0] ?? null,
    [needId, needsBySite],
  )

  const title = mode === 'arrival' ? 'Registrar llegada' : 'Registrar salida'
  const subtitle = mode === 'arrival' ? 'Donaciones recibidas' : 'Recursos distribuidos'

  const handleSubmit = async () => {
    setError(null)
    if (!selectedNeed) {
      setError('Selecciona una necesidad del centro.')
      return
    }
    const delta = Math.max(0, Number(quantity) || 0)
    if (!delta) {
      setError('Indica una cantidad mayor a 0.')
      return
    }
    const nextQty =
      mode === 'arrival'
        ? selectedNeed.available + delta
        : Math.max(0, selectedNeed.available - delta)
    try {
      await mutation.mutateAsync({
        needId: selectedNeed.id,
        qtyReceived: nextQty,
        notes: notes.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento.')
    }
  }

  if (!sites.length) {
    return (
      <FlowSheet title={title} subtitle={subtitle} onClose={onClose}>
        <GlassCard className="space-y-3">
          <p className="text-sm text-ink-muted">No hay centros disponibles todavía.</p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Entendido
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  if (done) {
    return (
      <FlowSheet title={title} subtitle={subtitle} onClose={onClose}>
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2 text-operational">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">Movimiento registrado</p>
          </div>
          <p className="text-sm text-ink-muted">
            {mode === 'arrival'
              ? 'El inventario subió y la prioridad del centro se recalculó.'
              : 'El inventario bajó y la necesidad fue actualizada.'}
          </p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Listo
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  return (
    <FlowSheet title={title} subtitle={subtitle} onClose={onClose}>
      <GlassCard className="space-y-4">
        <FormField label="Centro">
          {presetSiteId ? (
            <div className="flex h-12 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink">
              {sites.find((s) => s.id === siteId)?.name ?? 'Centro asignado'}
            </div>
          ) : (
            <select
              className={fieldClassName}
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value)
                setNeedId('')
              }}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id} className="bg-base-900">
                  {site.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Necesidad">
          <select className={fieldClassName} value={selectedNeed?.id ?? ''} onChange={(e) => setNeedId(e.target.value)}>
            {needsBySite.map((need) => (
              <option key={need.id} value={need.id} className="bg-base-900">
                {need.type} · disponible {need.available}/{need.required}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Cantidad">
          <input
            className={fieldClassName}
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Ej. 25"
          />
        </FormField>

        <FormField label="Observaciones (opcional)">
          <textarea
            className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-info/60"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Fuente, lote, destino..."
          />
        </FormField>

        {selectedNeed && (
          <p className="text-xs text-ink-subtle">
            Disponible actual: {selectedNeed.available} · Resultado estimado:{' '}
            {mode === 'arrival'
              ? selectedNeed.available + (Number(quantity) || 0)
              : Math.max(0, selectedNeed.available - (Number(quantity) || 0))}
          </p>
        )}

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={mutation.isPending || !selectedNeed}
          onClick={handleSubmit}
        >
          {mutation.isPending ? 'Guardando…' : mode === 'arrival' ? 'Registrar llegada' : 'Registrar salida'}
        </EmergencyButton>
      </GlassCard>
    </FlowSheet>
  )
}
