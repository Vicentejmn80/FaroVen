import { useMemo, useState } from 'react'
import { useCoordinatorProfile, useSaveCoordinatorSite } from '@/hooks/useCoordinatorProfile'
import { useSitesRegistry } from '@/hooks/useSitesRegistry'
import type { CoordinatorSiteType } from '@/lib/types'

const SITE_LABELS: Record<CoordinatorSiteType, string> = {
  hospital: 'Hospital',
  supply_center: 'Centro de acopio',
}

interface SiteSetupViewProps {
  notify: (msg: string) => void
  onDone: () => void
}

export function SiteSetupView({ notify, onDone }: SiteSetupViewProps) {
  const { data: profile } = useCoordinatorProfile()
  const { data: registry, isLoading } = useSitesRegistry()
  const saveSite = useSaveCoordinatorSite()

  const [siteType, setSiteType] = useState<CoordinatorSiteType>(profile?.site_type ?? 'supply_center')
  const [search, setSearch] = useState(profile?.site_name ?? '')
  const [newAddress, setNewAddress] = useState('')
  const [registerNew, setRegisterNew] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const list = (registry ?? []).filter((s) => s.type === siteType)
    const q = search.trim().toLowerCase()
    if (!q) return list.slice(0, 12)
    return list.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 12)
  }, [registry, siteType, search])

  const exactMatch = useMemo(
    () => filtered.find((s) => s.name.toLowerCase() === search.trim().toLowerCase()),
    [filtered, search]
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!search.trim()) {
      setError('Escribe el nombre del sitio.')
      return
    }
    try {
      if (registerNew || !exactMatch) {
        await saveSite.mutateAsync({
          site_type: siteType,
          new_site_name: search.trim(),
          new_site_address: newAddress.trim() || undefined,
        })
      } else {
        await saveSite.mutateAsync({ site_type: siteType, site_id: exactMatch.id })
      }
      notify('Sitio guardado. Ya puedes actualizar necesidades.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  if (isLoading) {
    return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando sitios…</p>
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <div>
        <label className="pv3-label">Tipo de sitio</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {(['hospital', 'supply_center'] as const).map((t) => (
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

      <div>
        <label className="pv3-label">Buscar o registrar sitio</label>
        <input
          className="pv3-input"
          style={{ marginTop: 5 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Nombre del ${SITE_LABELS[siteType].toLowerCase()}`}
        />
      </div>

      {filtered.length > 0 && !registerNew && (
        <div style={{ display: 'grid', gap: 6 }}>
          <p className="pv3-label">Coincidencias</p>
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              className="pv3-btn"
              style={{
                textAlign: 'left',
                borderColor: exactMatch?.id === s.id ? '#1a1a2e' : undefined,
                background: exactMatch?.id === s.id ? '#f0f4ff' : undefined,
              }}
              onClick={() => setSearch(s.name)}
            >
              {s.name}
              {s.address ? ` · ${s.address}` : ''}
            </button>
          ))}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={registerNew}
          onChange={(e) => setRegisterNew(e.target.checked)}
        />
        Es un sitio nuevo (no está en la lista)
      </label>

      {(registerNew || !exactMatch) && search.trim() && (
        <div>
          <label className="pv3-label">Dirección (opcional)</label>
          <input
            className="pv3-input"
            style={{ marginTop: 5 }}
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Calle, referencia, zona"
          />
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}

      <button type="submit" className="pv3-btn pv3-btn--primary" disabled={saveSite.isPending}>
        {saveSite.isPending ? 'Guardando…' : profile ? 'Actualizar mi sitio' : 'Confirmar mi sitio'}
      </button>
    </form>
  )
}
