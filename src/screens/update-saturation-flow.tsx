import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { FlowSheet, FormField, fieldClassName } from '@/components/faro/flow-sheet'
import { useUpdateSaturation } from '@/hooks/useFaroMutations'
import { siteToNeedableType } from '@/lib/site-utils'
import { useFaro } from '@/store/faro-context'

interface UpdateSaturationFlowProps {
  onClose: () => void
  presetSiteId?: string
}

export function UpdateSaturationFlow({ onClose, presetSiteId }: UpdateSaturationFlowProps) {
  const { sites } = useFaro()
  const eligibleSites = useMemo(
    () => sites.filter((s) => s.type === 'hospital' || s.type === 'shelter'),
    [sites],
  )
  const updateSaturation = useUpdateSaturation()
  const [siteId, setSiteId] = useState(presetSiteId ?? eligibleSites[0]?.id ?? '')
  const [currentOcc, setCurrentOcc] = useState('')
  const [capacity, setCapacity] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSite = useMemo(() => eligibleSites.find((s) => s.id === siteId), [eligibleSites, siteId])

  const handleSubmit = async () => {
    setError(null)
    if (!selectedSite) {
      setError('No hay hospitales ni refugios registrados.')
      return
    }
    const occ = Number(currentOcc)
    if (Number.isNaN(occ) || occ < 0) {
      setError('Indica una ocupación válida.')
      return
    }
    try {
      await updateSaturation.mutateAsync({
        siteId: selectedSite.id,
        siteType: siteToNeedableType(selectedSite),
        currentOcc: occ,
        capacity: capacity ? Number(capacity) : undefined,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la saturación.')
    }
  }

  if (!eligibleSites.length) {
    return (
      <FlowSheet title="Actualizar saturación" subtitle="Capacidad" onClose={onClose}>
        <GlassCard className="space-y-3">
          <p className="text-sm text-ink-muted">Registra un hospital o refugio para actualizar su ocupación.</p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Entendido
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  if (done) {
    return (
      <FlowSheet title="Saturación actualizada" subtitle="Capacidad" onClose={onClose}>
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2 text-operational">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">{selectedSite?.name} actualizado</p>
          </div>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Listo
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  return (
    <FlowSheet title="Actualizar saturación" subtitle="Capacidad" onClose={onClose}>
      <GlassCard className="space-y-4">
        <FormField label="Sitio">
          {presetSiteId ? (
            <div className="flex h-12 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink">
              {selectedSite?.name ?? 'Centro asignado'}
            </div>
          ) : (
            <select className={fieldClassName} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {eligibleSites.map((site) => (
                <option key={site.id} value={site.id} className="bg-base-900">
                  {site.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Personas ahora">
            <input className={fieldClassName} type="number" min={0} value={currentOcc} onChange={(e) => setCurrentOcc(e.target.value)} placeholder="Ej. 240" />
          </FormField>
          <FormField label="Capacidad total" hint="Opcional">
            <input className={fieldClassName} type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Ej. 300" />
          </FormField>
        </div>

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton variant="primary" size="lg" className="w-full" disabled={updateSaturation.isPending} onClick={handleSubmit}>
          {updateSaturation.isPending ? 'Guardando…' : 'Publicar actualización'}
        </EmergencyButton>
      </GlassCard>
    </FlowSheet>
  )
}
