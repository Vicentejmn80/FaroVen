import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { FlowSheet, FormField, fieldClassName } from '@/components/faro/flow-sheet'
import { useUpdateSaturation } from '@/hooks/useFaroMutations'
import { useSiteSaturation } from '@/hooks/useSiteSaturation'
import { SATURATION_LEVEL_LABELS, SATURATION_NEED_PRESETS, SATURATION_LEVEL_TONE } from '@/lib/saturation-needs'
import { siteToNeedableType } from '@/lib/site-utils'
import { usePermissions } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useFaro } from '@/store/faro-context'

interface UpdateSaturationFlowProps {
  onClose: () => void
  presetSiteId?: string
}

export function UpdateSaturationFlow({ onClose, presetSiteId }: UpdateSaturationFlowProps) {
  const { sites } = useFaro()
  const { isCoordinator, isRegionalAdmin, isSuperAdmin } = usePermissions()
  const { assignment } = useCoordinatorAssignment()
  const canPickAnySite = isRegionalAdmin || isSuperAdmin
  const eligibleSites = useMemo(
    () => {
      const filtered = sites
      if (canPickAnySite) return filtered
      if (isCoordinator) {
        if (!assignment?.siteId) return []
        return filtered.filter((s) => s.id === assignment.siteId)
      }
      return filtered
    },
    [sites, canPickAnySite, isCoordinator, assignment?.siteId],
  )
  const updateSaturation = useUpdateSaturation()
  const [siteId, setSiteId] = useState(presetSiteId ?? eligibleSites[0]?.id ?? '')
  const [needKey, setNeedKey] = useState<string>(SATURATION_NEED_PRESETS[0].key)
  const [customNeedLabel, setCustomNeedLabel] = useState('')
  const [level, setLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSite = useMemo(() => eligibleSites.find((s) => s.id === siteId), [eligibleSites, siteId])
  const siteType = selectedSite ? siteToNeedableType(selectedSite) : undefined
  const saturationQuery = useSiteSaturation(siteType, selectedSite?.id)
  const existingNeed = saturationQuery.data?.find((entry) => entry.needKey === needKey)
  const selectedNeed = SATURATION_NEED_PRESETS.find((need) => need.key === needKey)
  const needsList = saturationQuery.data ?? []

  useEffect(() => {
    if (existingNeed?.level) {
      setLevel(existingNeed.level)
    }
  }, [existingNeed?.level])

  useEffect(() => {
    if (siteId && eligibleSites.some((site) => site.id === siteId)) return
    setSiteId(eligibleSites[0]?.id ?? '')
  }, [eligibleSites, siteId])

  const handleSubmit = async () => {
    setError(null)
    if (!selectedSite) {
      setError('No hay sitios registrados.')
      return
    }
    if (!selectedNeed) {
      setError('Selecciona una necesidad.')
      return
    }
    const label =
      needKey === 'otros' ? customNeedLabel.trim() || 'Otros' : selectedNeed.label
    try {
      await updateSaturation.mutateAsync({
        siteId: selectedSite.id,
        siteType: siteToNeedableType(selectedSite),
        needKey,
        needLabel: label,
        level,
      })
      setDone(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la saturación.'
      setError(message.includes('permission') ? 'No tienes permisos para modificar este sitio.' : message)
    }
  }

  if (!eligibleSites.length) {
    return (
      <FlowSheet title="Actualizar saturación" subtitle="Necesidades" onClose={onClose}>
        <GlassCard className="space-y-3">
          <p className="text-sm text-ink-muted">Registra un sitio para actualizar su saturación.</p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Entendido
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  if (done) {
    return (
      <FlowSheet title="Saturación actualizada" subtitle="Necesidades" onClose={onClose}>
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
    <FlowSheet title="Actualizar saturación" subtitle="Necesidades" onClose={onClose}>
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

        <FormField label="Necesidad">
          <select className={fieldClassName} value={needKey} onChange={(e) => setNeedKey(e.target.value)}>
            {SATURATION_NEED_PRESETS.map((need) => (
              <option key={need.key} value={need.key} className="bg-base-900">
                {need.label}
              </option>
            ))}
          </select>
        </FormField>

        {needKey === 'otros' && (
          <FormField label="Especifica la necesidad">
            <input
              className={fieldClassName}
              value={customNeedLabel}
              onChange={(e) => setCustomNeedLabel(e.target.value)}
              placeholder="Ej. Agua para diálisis"
            />
          </FormField>
        )}

        <FormField label="Nivel de saturación">
          <select className={fieldClassName} value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            {Object.entries(SATURATION_LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-base-900">
                {label}
              </option>
            ))}
          </select>
        </FormField>

        {needsList.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-ink-subtle">
            <p className="mb-2 text-sm text-ink">Saturación registrada</p>
            <div className="space-y-1">
              {needsList.map((entry) => (
                <div key={entry.needKey} className="flex items-center justify-between">
                  <span>{entry.needLabel}</span>
                  <span className={SATURATION_LEVEL_TONE[entry.level]}>{SATURATION_LEVEL_LABELS[entry.level]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton variant="primary" size="lg" className="w-full" disabled={updateSaturation.isPending} onClick={handleSubmit}>
          {updateSaturation.isPending ? 'Guardando…' : 'Publicar actualización'}
        </EmergencyButton>
      </GlassCard>
    </FlowSheet>
  )
}
