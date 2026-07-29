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

/**
 * Creación manual GC → solicitud en Nuevo; la revisión inicia al abrir el caso.
 */
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
    if (!title.trim() || !zone.trim()) {
      setError('Título y zona (destino) son obligatorios.')
      return
    }
    if (!hasValidCoordinates(place)) {
      setError('Marca una ubicación válida en el mapa. No se puede guardar sin coordenadas.')
      return
    }
    if (!category.trim()) {
      setError('Selecciona una categoría.')
      return
    }
    if (!user?.id) {
      setError('Debes iniciar sesión como Gestor de Casos.')
      return
    }
    try {
      const result = await createCase.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        zone: zone.trim(),
        priority,
        category: category.trim(),
        affectedCount: Math.max(1, Number(affectedCount) || 1),
        location: {
          lat: place!.lat,
          lng: place!.lng,
          address: place!.name ?? zone.trim(),
        },
        reporterInfo: {
          name: reporterName.trim() || undefined,
          phone: reporterPhone.trim() || undefined,
        },
        actorId: user.id,
        responsibleId: user.id,
        destination: zone.trim(),
        requirePublishReady: true,
        requestSource: 'manual',
        requestType: 'manual_request',
        operationType,
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
      subtitle="Entra a Nuevo — el GC inicia la revisión al abrir el caso"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-8">
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

        <FormField label="Destino (zona / sector)">
          <input
            className={fieldClassName}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Ej. Maiquetía, Sector 3"
            required
          />
        </FormField>

        <FormField label="Ubicación en el mapa">
          <p className="mb-2 text-[11px] text-ink-subtle">
            {geoBusy
              ? 'Solicitando permiso de geolocalización…'
              : geoHint
                ? geoHint
                : 'Toca el mapa para fijar el punto. Obligatorio para publicar.'}
          </p>
          <LocationPickerMap
            value={place}
            onChange={setPlace}
            onNameHint={(name) => {
              if (!zone.trim()) setZone(name)
            }}
            className="min-h-[240px] overflow-hidden rounded-2xl border border-white/10"
          />
          {place && hasValidCoordinates(place) && (
            <p className="mt-1 text-[11px] text-operational">
              Lat {place.lat.toFixed(5)} · Lng {place.lng.toFixed(5)}
            </p>
          )}
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
          <FormField label="Teléfono contacto">
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

        <p className="text-[11px] text-ink-subtle">
          Responsable: {user?.email ?? user?.id ?? '—'}
        </p>

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton type="submit" className="w-full" disabled={createCase.isPending}>
          {createCase.isPending ? 'Publicando…' : 'Publicar en Nuevo'}
        </EmergencyButton>
      </form>
    </FlowSheet>
  )
}
