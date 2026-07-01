import { useState } from 'react'
import { useCoordinatorProfile, useSaveCoordinatorSite } from '@/hooks/useCoordinatorProfile'
import type { CoordinatorSiteType } from '@/lib/types'
import { normalizeVePhone } from '../../lib/phone'
import { LocationPicker, type PickedLocation } from './LocationPicker'

const SITE_LABELS: Record<CoordinatorSiteType, string> = {
  hospital: 'Hospital',
  supply_center: 'Centro de acopio',
  shelter: 'Refugio',
}

const ROLE_OPTIONS = [
  'Coordinación de insumos y logística',
  'Recepción y clasificación de donaciones',
  'Coordinación médica / operaciones hospitalarias',
  'Operaciones en refugio o albergue',
  'Enlace con organización o brigada',
  'Otro',
]

interface CoordinatorOnboardingViewProps {
  notify: (msg: string) => void
  onDone: () => void
}

export function CoordinatorOnboardingView({ notify, onDone }: CoordinatorOnboardingViewProps) {
  const { data: profile, isLoading } = useCoordinatorProfile()
  const saveSite = useSaveCoordinatorSite()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone?.replace(/^\+58/, '0') ?? '')
  const [roleTitle, setRoleTitle] = useState(profile?.role_title ?? '')
  const [responsibilities, setResponsibilities] = useState(profile?.responsibilities ?? '')

  const [siteType, setSiteType] = useState<CoordinatorSiteType>(profile?.site_type ?? 'supply_center')
  const [location, setLocation] = useState<PickedLocation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError('Indica tu nombre completo.')
      return
    }
    if (!phone.trim()) {
      setError('Indica un teléfono de contacto.')
      return
    }
    if (!roleTitle.trim()) {
      setError('Indica tu responsabilidad.')
      return
    }
    if (!location) {
      setError('Busca tu sitio en el mapa y confírmalo antes de continuar.')
      return
    }

    const e164 = normalizeVePhone(phone)
    if (!e164) {
      setError('Teléfono inválido. Usa formato venezolano, por ejemplo 0414 1234567.')
      return
    }

    try {
      await saveSite.mutateAsync({
        full_name: fullName.trim(),
        phone: e164,
        role_title: roleTitle.trim(),
        city_zone: location.cityZone || undefined,
        responsibilities: responsibilities.trim() || undefined,
        onboarding_complete: true,
        site_type: siteType,
        new_site_name: location.name,
        new_site_address: location.address,
        new_site_latitude: location.latitude,
        new_site_longitude: location.longitude,
      })

      notify('Registro completado. Ya puedes publicar necesidades de tu sitio.')
      onDone()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar el registro'
      if (message.includes('column') && message.includes('does not exist')) {
        setError('Falta aplicar la migración en Supabase (20260629140000_coordinator_hardening.sql).')
        return
      }
      setError(message)
    }
  }

  if (isLoading) {
    return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando…</p>
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <p style={{ fontSize: 13, color: '#5f6373', margin: 0, lineHeight: 1.45 }}>
        Completa tus datos y ubica tu sitio en el mapa. Solo tú podrás actualizar las necesidades de
        ese lugar.
      </p>

      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        <legend className="pv3-label" style={{ marginBottom: 4 }}>Tus datos</legend>
        <div>
          <label className="pv3-label">Nombre completo</label>
          <input
            className="pv3-input"
            style={{ marginTop: 5 }}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej. María González"
            required
          />
        </div>
        <div>
          <label className="pv3-label">Teléfono de contacto</label>
          <input
            type="tel"
            className="pv3-input"
            style={{ marginTop: 5 }}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0414 1234567"
            required
          />
        </div>
        <div>
          <label className="pv3-label">Tu responsabilidad</label>
          <select
            className="pv3-input"
            style={{ marginTop: 5 }}
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            required
          >
            <option value="">Seleccionar…</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        <legend className="pv3-label" style={{ marginBottom: 4 }}>Ubicación del sitio</legend>
        <div>
          <label className="pv3-label">Tipo de sitio</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {(['hospital', 'supply_center', 'shelter'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`pv3-btn ${siteType === t ? 'pv3-btn--primary' : ''}`}
                onClick={() => setSiteType(t)}
              >
                {SITE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <LocationPicker
          confirmed={location}
          onConfirm={setLocation}
          onClear={() => setLocation(null)}
        />

        <div>
          <label className="pv3-label">Notas (opcional)</label>
          <textarea
            className="pv3-input"
            style={{ marginTop: 5, minHeight: 64, resize: 'vertical' }}
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            placeholder="Ej. Recepción de donaciones, turno nocturno…"
          />
        </div>
      </fieldset>

      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}

      <button type="submit" className="pv3-btn pv3-btn--primary" disabled={saveSite.isPending || !location}>
        {saveSite.isPending ? 'Guardando…' : 'Completar registro y entrar al panel'}
      </button>
    </form>
  )
}
