import { useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { FlowSheet, FormField, TypePills, fieldClassName } from '@/components/faro/flow-sheet'
import { LocationPickerMap } from '@/components/faro/location-picker-map'
import { useRegisterSite } from '@/hooks/useFaroMutations'
import type { ResolvedPlace } from '@/lib/osm-geocoding'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { SITE_TYPE_LABELS } from '@/lib/site-utils'
import type { RegisterSiteType } from '@/repositories/types'

interface RegisterSiteFlowProps {
  onClose: () => void
  onSuccess?: () => void
}

export function RegisterSiteFlow({ onClose, onSuccess }: RegisterSiteFlowProps) {
  const registerSite = useRegisterSite()
  const [type, setType] = useState<RegisterSiteType>('hospital')
  const [name, setName] = useState('')
  const [place, setPlace] = useState<ResolvedPlace | null>(null)
  const [capacity, setCapacity] = useState('100')
  const [currentOcc, setCurrentOcc] = useState('0')
  const [contactName, setContactName] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (name.trim().length < 3) {
      setError('Escribe un nombre de al menos 3 caracteres.')
      return
    }
    if (!place) {
      setError('Confirma la ubicación en el mapa: busca, usa GPS o toca el punto exacto.')
      return
    }

    try {
      await registerSite.mutateAsync({
        type,
        name: name.trim(),
        address: place.address,
        latitude: place.lat,
        longitude: place.lng,
        capacity: Number(capacity) || 100,
        currentOcc: Number(currentOcc) || 0,
        contactName: contactName.trim() || undefined,
      })
      setDone(true)
      onSuccess?.()
    } catch (err) {
      setError(humanizeSupabaseError(err))
    }
  }

  if (done) {
    return (
      <FlowSheet title="Sitio registrado" subtitle="Operaciones" onClose={onClose}>
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2 text-operational">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">{name} ya está en el mapa</p>
          </div>
          <p className="text-sm text-ink-muted">
            Aparecerá en Situación en unos segundos. Ahora puedes agregar necesidades desde el botón +.
          </p>
          {place && (
            <a
              href={place.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-info hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Ver en OpenStreetMap
            </a>
          )}
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Listo
          </EmergencyButton>
        </GlassCard>
      </FlowSheet>
    )
  }

  return (
    <FlowSheet title="Registrar sitio" subtitle="Mapa operativo" onClose={onClose}>
      <div className="space-y-4">
        <GlassCard className="space-y-4">
          <FormField label="Tipo de sitio">
            <TypePills
              value={type}
              onChange={setType}
              options={(
                Object.entries(SITE_TYPE_LABELS) as Array<[RegisterSiteType, string]>
              ).map(([value, label]) => ({ value, label }))}
            />
          </FormField>

          <FormField label="Nombre">
            <input
              className={fieldClassName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Hospital Miguel Pérez Carreño"
            />
          </FormField>

          <FormField label="Ubicación en el mapa" hint="Mismo mapa que la consola — busca, GPS o toca para fijar el pin">
            <LocationPickerMap
              value={place}
              onChange={setPlace}
              onNameHint={(hint) => {
                if (!name.trim()) setName(hint)
              }}
            />
          </FormField>

          {type !== 'supply_center' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Capacidad">
                <input className={fieldClassName} type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </FormField>
              <FormField label="Ocupación actual">
                <input className={fieldClassName} type="number" min={0} value={currentOcc} onChange={(e) => setCurrentOcc(e.target.value)} />
              </FormField>
            </div>
          )}

          <FormField label="Responsable (opcional)">
            <input className={fieldClassName} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre del coordinador" />
          </FormField>

          {error && <p className="text-sm text-critical">{error}</p>}

          <EmergencyButton
            variant="primary"
            size="lg"
            className="w-full"
            disabled={registerSite.isPending || !place}
            onClick={handleSubmit}
          >
            {registerSite.isPending ? 'Guardando…' : 'Publicar en el mapa'}
          </EmergencyButton>
        </GlassCard>
      </div>
    </FlowSheet>
  )
}
