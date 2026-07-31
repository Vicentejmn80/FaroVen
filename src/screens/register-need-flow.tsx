import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { FlowSheet, FormField, fieldClassName } from '@/components/faro/flow-sheet'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { useCreateCase } from '@/hooks/useCaseMutations'
import { useAuth } from '@/store/auth-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import {
  NEED_CATEGORIES,
  NEED_ITEM_PRESETS,
  type NeedCategoryKey,
  qtyPlaceholderForCategory,
  resolveNeedItemName,
} from '@/lib/need-catalog'
import { PRIORITY_OPTIONS } from '@/lib/site-utils'
import { useFaro } from '@/store/faro-context'

interface RegisterNeedFlowProps {
  onClose: () => void
  presetSiteId?: string
}

/**
 * Solicitud operativa del coordinador → caso en Nuevo del GC.
 * Ya no escribe en la tabla legacy `needs`.
 */
export function RegisterNeedFlow({ onClose, presetSiteId }: RegisterNeedFlowProps) {
  const { sites } = useFaro()
  const { user, profile } = useAuth()
  const { assignment } = useCoordinatorAssignment()
  const createCase = useCreateCase()
  const defaultSiteId = presetSiteId ?? assignment?.siteId ?? sites[0]?.id ?? ''
  const [siteId, setSiteId] = useState(defaultSiteId)
  useEffect(() => {
    if (presetSiteId) setSiteId(presetSiteId)
    else if (assignment?.siteId) setSiteId(assignment.siteId)
  }, [presetSiteId, assignment?.siteId])
  const [categoryKey, setCategoryKey] = useState<NeedCategoryKey>(NEED_CATEGORIES[0].key)
  const [presetItem, setPresetItem] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high')
  const [qtyRequired, setQtyRequired] = useState('50')
  const [done, setDone] = useState(false)
  const [savedItemName, setSavedItemName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const skipCategoryReset = useRef(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('faro:need-preset')
      if (!raw) return
      sessionStorage.removeItem('faro:need-preset')
      const preset = JSON.parse(raw) as {
        categoryKey?: string
        itemName?: string
        quantity?: number
      }
      skipCategoryReset.current = true
      if (preset.categoryKey && NEED_CATEGORIES.some((c) => c.key === preset.categoryKey)) {
        setCategoryKey(preset.categoryKey as NeedCategoryKey)
      }
      if (preset.itemName) {
        setPresetItem(preset.itemName)
        setCustomLabel(preset.itemName)
      }
      if (preset.quantity && preset.quantity > 0) {
        setQtyRequired(String(preset.quantity))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const selectedSite = useMemo(() => sites.find((s) => s.id === siteId), [sites, siteId])
  const categoryPresets = NEED_ITEM_PRESETS[categoryKey]
  const usesPresetList = Boolean(categoryPresets?.length)
  const usesCustomOnly = categoryKey === 'otros'

  useEffect(() => {
    if (skipCategoryReset.current) {
      skipCategoryReset.current = false
      return
    }
    const presets = NEED_ITEM_PRESETS[categoryKey]
    if (presets?.length) {
      setPresetItem(presets[0])
      setCustomLabel('')
    } else {
      setPresetItem('')
      setCustomLabel('')
    }
  }, [categoryKey])

  const resolvedItemName = useMemo(
    () => resolveNeedItemName(categoryKey, presetItem, customLabel),
    [categoryKey, presetItem, customLabel],
  )

  const qtyPlaceholder = qtyPlaceholderForCategory(categoryKey, resolvedItemName)

  const handleSubmit = async () => {
    setError(null)
    if (!selectedSite && !assignment?.siteId) {
      setError('No hay un centro asignado para solicitar recursos.')
      return
    }
    const itemName = resolvedItemName
    if (itemName.length < 2) {
      setError('Describe el recurso o apoyo solicitado.')
      return
    }
    const centerId = selectedSite?.id ?? assignment?.siteId ?? ''
    const zone = selectedSite?.name ?? assignment?.siteName ?? 'Centro'
    const lat = selectedSite?.lat
    const lng = selectedSite?.lng
    const hasCoords =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0)
    try {
      const coordinatorName = profile?.full_name?.trim() || 'Coordinador'
      await createCase.mutateAsync({
        title: `Solicitud: ${itemName}`,
        description: `Coordinador de ${zone} solicita ${qtyRequired} de ${itemName} (${NEED_CATEGORIES.find((c) => c.key === categoryKey)?.label ?? categoryKey}).`,
        priority,
        zone,
        category: itemName,
        affectedCount: Math.max(1, Number(qtyRequired) || 1),
        location: hasCoords
          ? { lat: lat!, lng: lng!, address: selectedSite?.zone }
          : undefined,
        actorId: user?.id,
        requestingCenterId: centerId,
        requestSource: 'coordinator',
        requestType: 'inventory_request',
        operationType: 'resource_request',
        responsibleId: user?.id,
        destination: zone,
        reporterInfo: {
          name: coordinatorName,
          phone: profile?.phone ?? undefined,
          relationship: `Centro: ${zone}`,
        },
      })
      setSavedItemName(itemName)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    }
  }

  if (done) {
    return (
      <FlowSheet title="Solicitud enviada" subtitle="Bandeja del Gestor de Casos" onClose={onClose}>
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2 text-operational">
            <CheckCircle2 className="h-5 w-5" />
            <NeedItemLabel name={savedItemName} className="font-semibold text-ink" />
          </div>
          <p className="text-sm text-ink-muted">
            Tu solicitud entró a <strong className="text-ink">Nuevo</strong>. El Gestor de Casos
            la abrirá en revisión y decidirá si abrir cobertura, transferir inventario o asignar una institución.
          </p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Listo
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  return (
    <FlowSheet title="Solicitar recurso" subtitle="Apoyo operativo al GC" onClose={onClose}>
      <GlassCard className="space-y-4">
        <FormField label="Centro solicitante">
          <div className="flex h-12 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink">
            {selectedSite?.name ?? assignment?.siteName ?? 'Centro asignado'}
          </div>
        </FormField>

        <FormField label="Categoría">
          <select
            className={fieldClassName}
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value as NeedCategoryKey)}
          >
            {NEED_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key} className="bg-base-900">
                {category.label}
              </option>
            ))}
          </select>
        </FormField>

        {usesPresetList && (
          <FormField label="Recurso / apoyo">
            <select
              className={fieldClassName}
              value={presetItem}
              onChange={(e) => setPresetItem(e.target.value)}
            >
              {categoryPresets!.map((item) => (
                <option key={item} value={item} className="bg-base-900">
                  {item}
                </option>
              ))}
              <option value="__custom__" className="bg-base-900">
                Otro (especificar)
              </option>
            </select>
          </FormField>
        )}

        {(usesCustomOnly || presetItem === '__custom__') && (
          <FormField label="Especifica el recurso">
            <input
              className={fieldClassName}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Ej. colchonetas, agua potable, apoyo psicológico"
            />
          </FormField>
        )}

        {resolvedItemName.length >= 2 && (
          <p className="text-xs text-ink-subtle">
            Vista previa: <NeedItemLabel name={resolvedItemName} />
          </p>
        )}

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

        <FormField label="Cantidad solicitada">
          <input
            className={fieldClassName}
            type="number"
            min={1}
            value={qtyRequired}
            onChange={(e) => setQtyRequired(e.target.value)}
            placeholder={qtyPlaceholder}
          />
        </FormField>

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={createCase.isPending}
          onClick={handleSubmit}
        >
          {createCase.isPending ? 'Enviando…' : 'Solicitar apoyo'}
        </EmergencyButton>
      </GlassCard>
    </FlowSheet>
  )
}
