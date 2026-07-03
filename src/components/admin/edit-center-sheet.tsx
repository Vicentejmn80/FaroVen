import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { FlowSheet, fieldClassName, textareaClassName } from '@/components/faro/flow-sheet'
import { LocationPickerMap } from '@/components/faro/location-picker-map'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useUpdateCenter } from '@/hooks/useFaroMutations'
import type { Center } from '@/domain/models'
import type { Site } from '@/lib/types'
import type { ResolvedPlace } from '@/lib/osm-geocoding'
import { siteToNeedableType } from '@/lib/site-utils'
import { humanizeSupabaseError } from '@/lib/supabase-errors'

interface EditCenterSheetProps {
  site: Site
  center?: Center
  onClose: () => void
}

export function EditCenterSheet({ site, center, onClose }: EditCenterSheetProps) {
  const updateCenter = useUpdateCenter()
  const siteType = siteToNeedableType(site)
  const hasCapacity = siteType !== 'supply_center'

  const [name, setName] = useState(center?.name ?? site.name)
  const [municipality, setMunicipality] = useState(center?.municipality ?? '')
  const [state, setState] = useState(center?.state ?? '')
  const [contactName, setContactName] = useState(center?.responsible.name ?? '')
  const [phone, setPhone] = useState(center?.phone ?? '')
  const [capacity, setCapacity] = useState(String(center?.capacity.total ?? 100))
  const [currentOcc, setCurrentOcc] = useState(String(center?.capacity.current ?? 0))
  const [schedule, setSchedule] = useState(center?.schedule ?? '')
  const [observations, setObservations] = useState(center?.observations ?? '')
  const [place, setPlace] = useState<ResolvedPlace | null>(
    site.lat && site.lng
      ? {
          lat: site.lat,
          lng: site.lng,
          address: center?.location.address ?? site.zone,
          mapUrl: '',
        }
      : null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (place && !place.mapUrl) {
      setPlace((prev) =>
        prev
          ? {
              ...prev,
              mapUrl: `https://www.openstreetmap.org/?mlat=${prev.lat}&mlon=${prev.lng}`,
            }
          : prev,
      )
    }
  }, [place])

  async function handleSave() {
    if (name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }

    setError(null)
    try {
      await updateCenter.mutateAsync({
        id: site.id,
        type: siteType,
        name: name.trim(),
        address: place?.address,
        municipality: municipality.trim() || undefined,
        state: state.trim() || undefined,
        latitude: place?.lat,
        longitude: place?.lng,
        capacity: hasCapacity ? Number(capacity) || 100 : undefined,
        currentOcc: hasCapacity ? Number(currentOcc) || 0 : undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: phone.trim() || undefined,
        schedule: schedule.trim() || undefined,
        observations: observations.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(humanizeSupabaseError(err))
    }
  }

  return (
    <FlowSheet title="Editar centro" subtitle={site.name} onClose={onClose}>
      <div className="space-y-4 px-5 pb-8">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Nombre</span>
          <input className={fieldClassName} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <LocationPickerMap
          value={place}
          onChange={setPlace}
          onNameHint={(hint) => {
            if (!name.trim() || name === site.name) setName(hint)
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Municipio</span>
            <input
              className={fieldClassName}
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder="Ej. Libertador"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Estado</span>
            <input
              className={fieldClassName}
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Ej. Miranda"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Responsable</span>
          <input
            className={fieldClassName}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Teléfono</span>
          <input className={fieldClassName} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        {hasCapacity && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">Capacidad</span>
              <input
                className={fieldClassName}
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">Ocupación actual</span>
              <input
                className={fieldClassName}
                type="number"
                min={0}
                value={currentOcc}
                onChange={(e) => setCurrentOcc(e.target.value)}
              />
            </label>
          </div>
        )}

        {!hasCapacity && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Horario</span>
            <input className={fieldClassName} value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Observaciones</span>
          <textarea
            className={textareaClassName}
            rows={3}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={updateCenter.isPending}
          onClick={() => void handleSave()}
        >
          <Pencil className="h-4 w-4" />
          {updateCenter.isPending ? 'Guardando…' : 'Guardar cambios'}
        </EmergencyButton>
      </div>
    </FlowSheet>
  )
}
