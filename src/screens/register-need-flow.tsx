import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { FlowSheet, FormField, fieldClassName } from '@/components/faro/flow-sheet'
import { useRegisterNeed } from '@/hooks/useFaroMutations'
import { PRIORITY_OPTIONS, siteToNeedableType } from '@/lib/site-utils'
import { useFaro } from '@/store/faro-context'

interface RegisterNeedFlowProps {
  onClose: () => void
  presetSiteId?: string
}

export function RegisterNeedFlow({ onClose, presetSiteId }: RegisterNeedFlowProps) {
  const { sites } = useFaro()
  const registerNeed = useRegisterNeed()
  const [siteId, setSiteId] = useState(presetSiteId ?? sites[0]?.id ?? '')
  useEffect(() => {
    if (presetSiteId) setSiteId(presetSiteId)
  }, [presetSiteId])
  const [itemName, setItemName] = useState('')
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high')
  const [qtyRequired, setQtyRequired] = useState('50')
  const [qtyReceived, setQtyReceived] = useState('0')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSite = useMemo(() => sites.find((s) => s.id === siteId), [sites, siteId])

  const handleSubmit = async () => {
    setError(null)
    if (!selectedSite) {
      setError('Primero registra un sitio en el mapa.')
      return
    }
    if (itemName.trim().length < 2) {
      setError('Describe el insumo o necesidad.')
      return
    }
    try {
      await registerNeed.mutateAsync({
        needableType: siteToNeedableType(selectedSite),
        needableId: selectedSite.id,
        itemName: itemName.trim(),
        priority,
        qtyRequired: Number(qtyRequired) || 1,
        qtyReceived: Number(qtyReceived) || 0,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la necesidad.')
    }
  }

  if (!sites.length) {
    return (
      <FlowSheet title="Registrar necesidad" subtitle="Inventario" onClose={onClose}>
        <GlassCard className="space-y-3">
          <p className="text-sm text-ink-muted">Aún no hay sitios en el mapa. Registra uno primero con el botón +.</p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Entendido
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  if (done) {
    return (
      <FlowSheet title="Necesidad registrada" subtitle="Inventario" onClose={onClose}>
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2 text-operational">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">{itemName} agregado</p>
          </div>
          <p className="text-sm text-ink-muted">Se reflejará en prioridades y en la ficha de {selectedSite?.name}.</p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Listo
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  return (
    <FlowSheet title="Registrar necesidad" subtitle="Inventario" onClose={onClose}>
      <GlassCard className="space-y-4">
        <FormField label="Sitio">
          {presetSiteId ? (
            <div className="flex h-12 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink">
              {selectedSite?.name ?? 'Centro asignado'}
            </div>
          ) : (
            <select className={fieldClassName} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((site) => (
                <option key={site.id} value={site.id} className="bg-base-900">
                  {site.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Insumo o necesidad">
          <input className={fieldClassName} value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Ej. colchonetas, teteros, suero" />
        </FormField>

        <FormField label="Prioridad">
          <div className="grid grid-cols-2 gap-2">
            {PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                className={
                  priority === option.value
                    ? 'min-h-11 rounded-2xl border border-info/60 bg-info-soft px-2 text-sm font-medium text-ink'
                    : 'min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-2 text-sm text-ink-muted'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Cantidad requerida">
            <input className={fieldClassName} type="number" min={1} value={qtyRequired} onChange={(e) => setQtyRequired(e.target.value)} />
          </FormField>
          <FormField label="Ya disponible">
            <input className={fieldClassName} type="number" min={0} value={qtyReceived} onChange={(e) => setQtyReceived(e.target.value)} />
          </FormField>
        </div>

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton variant="primary" size="lg" className="w-full" disabled={registerNeed.isPending} onClick={handleSubmit}>
          {registerNeed.isPending ? 'Guardando…' : 'Publicar necesidad'}
        </EmergencyButton>
      </GlassCard>
    </FlowSheet>
  )
}
