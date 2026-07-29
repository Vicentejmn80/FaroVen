import { useEffect, useState } from 'react'
import { FlowSheet, FormField, fieldClassName, textareaClassName } from '@/components/faro/flow-sheet'
import { LocationPickerMap } from '@/components/faro/location-picker-map'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useCreateCase } from '@/hooks/useCaseMutations'
import { useAuth } from '@/store/auth-context'
import type { CasePriority, OperationType } from '@/domain/case-lifecycle.types'
import { hasValidCoordinates } from '@/domain/case-publish-validation'
import { listSelectableResources } from '@/lib/resource-catalog'
import type { ResolvedPlace } from '@/lib/osm-geocoding'
import { osmMapUrl } from '@/lib/osm-geocoding'
import { readCurrentPosition } from '@/lib/site-utils'
import { cn } from '@/lib/utils'

interface CreateCaseFormProps {
  onClose: () => void
  onCreated?: (caseId: string) => void
}

const PRIORITIES: Array<{ value: CasePriority; label: string }> = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

const OPERATION_OPTIONS: Array<{ value: OperationType; label: string }> = [
  { value: 'incident', label: 'Incidente' },
  { value: 'volunteer_mission', label: 'Misión de voluntariado' },
  { value: 'resource_request', label: 'Solicitud de recursos' },
]

/** Creación manual GC — mapa primero; caso entra en Nuevo. */
export function CreateCaseForm({ onClose, onCreated }: CreateCaseFormProps) {
  const { user } = useAuth()
  const createCase = useCreateCase()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [zone, setZone] = useState('')
  const [priority, setPriority] = useState<CasePriority>('high')
  const [operationType, setOperationType] = useState<OperationType>('incident')
  const [category, setCategory] = useState('agua')
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [affectedCount, setAffectedCount] = useState('1')
  const [place, setPlace] = useState<ResolvedPlace | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoHint, setGeoHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setGeoBusy(true)
    void readCurrentPosition().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setPlace((prev) =>
          prev ?? {
            lat: result.lat,
            lng: result.lng,
            name: 'Mi ubicación',
            address: 'Mi ubicación',
            mapUrl: osmMapUrl(result.lat, result.lng),
          },
        )
        setGeoHint(null)
      } else {
        setGeoHint(result.reason)
      }
      setGeoBusy(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!place || !hasValidCoordinates(place)) {
      setError('Toca el mapa para marcar la ubicación antes de guardar.')
      return
    }
    const qty = Math.max(1, Number.parseInt(affectedCount, 10) || 1)
    try {
      const result = await createCase.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        zone: zone.trim() || place.name || place.address || 'Zona por confirmar',
        category,
        affectedCount: qty,
        location: { lat: place.lat, lng: place.lng, address: place.address || place.name },
        reporterInfo: {
          name: reporterName.trim() || undefined,
          phone: reporterPhone.trim() || undefined,
        },
        actorId: user?.id,
        requestSource: 'manual',
        requestType: 'manual_request',
        operationType,
        requirePublishReady: true,
        responsibleId: user?.id,
        destination: zone.trim() || place.name,
      })
      onCreated?.(result.case.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la solicitud.')
    }
  }

  return (
    <FlowSheet
      title="Crear solicitud operativa"
      subtitle="Toca el mapa → guardar → entra a Nuevo"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-8">
        <FormField label="Ubicación">
          <p className="mb-2 text-[11px] text-ink-subtle">
            {geoBusy
              ? 'Solicitando GPS…'
              : geoHint
                ? `${geoHint} — toca el mapa para marcar el punto.`
                : 'Toca el mapa para fijar la ubicación. Obligatorio.'}
          </p>
          <LocationPickerMap
            value={place}
            onChange={(p) => {
              setPlace(p)
              if (p?.name || p?.address) setZone(p.name || p.address || '')
            }}
            onNameHint={(name) => setZone(name)}
            className="min-h-[280px] overflow-hidden rounded-2xl border border-white/10"
          />
          {place && hasValidCoordinates(place) && (
            <p className="mt-1.5 text-[11px] text-operational">
              Punto guardado · {place.address || place.name || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}
            </p>
          )}
        </FormField>

        <FormField label="Título">
          <input
            className={fieldClassName}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Familia sin refugio en La Guaira"
            required
          />
        </FormField>

        <FormField label="Tipo de operación">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {OPERATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setOperationType(opt.value)}
                className={
                  operationType === opt.value
                    ? 'rounded-xl border border-info/40 bg-info/15 px-2 py-2 text-xs font-semibold text-info'
                    : 'rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-xs text-ink-muted'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Categoría / recurso">
          <select
            className={fieldClassName}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {listSelectableResources().map((item) => (
              <option key={item.key} value={item.key} className="bg-base-900">
                {item.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Zona (desde el mapa)">
          <input
            className={fieldClassName}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Se completa al tocar el mapa"
            required
          />
        </FormField>

        <FormField label="Prioridad">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={
                  priority === p.value
                    ? 'rounded-xl border border-info/40 bg-info/15 px-2 py-2 text-xs font-semibold text-info'
                    : 'rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-xs text-ink-muted'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Descripción">
          <textarea
            className={cn(textareaClassName, 'resize-y')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Necesidades, contexto y urgencia…"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Cantidad">
            <input
              type="number"
              min={1}
              className={fieldClassName}
              value={affectedCount}
              onChange={(e) => setAffectedCount(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Teléfono">
            <input
              className={fieldClassName}
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>
        </div>

        <FormField label="Nombre del ciudadano">
          <input
            className={fieldClassName}
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            placeholder="Opcional"
          />
        </FormField>

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton type="submit" className="w-full" disabled={createCase.isPending}>
          {createCase.isPending ? 'Publicando…' : 'Guardar en Nuevo'}
        </EmergencyButton>
      </form>
    </FlowSheet>
  )
}
