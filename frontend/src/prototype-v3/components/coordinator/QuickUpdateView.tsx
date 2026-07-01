import { useEffect, useState } from 'react'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useLocationNeeds, useQuickUpdate } from '@/hooks/useQuickUpdate'
import type { NeedPriority } from '@/lib/types'
import { PRIORITY_LABELS } from '@/lib/types'

interface QuickUpdateViewProps {
  notify: (msg: string) => void
  onNeedSite: () => void
}

export function QuickUpdateView({ notify, onNeedSite }: QuickUpdateViewProps) {
  const { data: profile, isLoading } = useCoordinatorProfile()
  const [existingNeedId, setExistingNeedId] = useState('')
  const [itemName, setItemName] = useState('')
  const [priority, setPriority] = useState<NeedPriority>('high')
  const [qtyRequired, setQtyRequired] = useState('100')
  const [qtyReceived, setQtyReceived] = useState('0')
  const [unit, setUnit] = useState('unidades')
  const [notes, setNotes] = useState('')

  const { data: locationNeeds } = useLocationNeeds(profile?.site_type, profile?.site_id)
  const mutation = useQuickUpdate()

  useEffect(() => {
    if (!existingNeedId || !locationNeeds) return
    const need = locationNeeds.find((n) => n.id === existingNeedId)
    if (!need) return
    setItemName(need.item_name)
    setPriority(need.priority)
    setQtyRequired(String(need.qty_required))
    setQtyReceived(String(need.qty_received))
    setUnit(need.unit)
    setNotes(need.notes ?? '')
  }, [existingNeedId, locationNeeds])

  if (isLoading) {
    return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando…</p>
  }

  if (!profile) {
    return (
      <div className="pv3-card">
        <p style={{ fontSize: 13, color: '#5f6373', margin: '0 0 12px' }}>
          Primero configura qué sitio coordinas.
        </p>
        <button type="button" className="pv3-btn pv3-btn--primary" onClick={onNeedSite}>
          Configurar mi sitio
        </button>
      </div>
    )
  }

  if (profile.onboarding_complete === false) {
    return (
      <div className="pv3-card">
        <p style={{ fontSize: 13, color: '#5f6373', margin: 0 }}>
          Completa tu registro de coordinador antes de publicar necesidades.
        </p>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName.trim()) {
      notify('Escribe el nombre del insumo.')
      return
    }
    try {
      await mutation.mutateAsync({
        needable_type: profile.site_type,
        needable_id: profile.site_id,
        item_name: itemName.trim(),
        priority,
        qty_required: Number(qtyRequired) || 0,
        qty_received: Number(qtyReceived) || 0,
        unit: unit.trim() || 'unidades',
        notes: notes.trim() || undefined,
        existing_need_id: existingNeedId || undefined,
      })
      notify('Necesidad actualizada — ya se ve en el mapa y las tarjetas.')
      if (!existingNeedId) {
        setItemName('')
        setNotes('')
        setQtyReceived('0')
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <p style={{ fontSize: 13, color: '#5f6373', margin: 0 }}>
        Coordinando: <strong>{profile.site_name}</strong>
      </p>

      {locationNeeds && locationNeeds.length > 0 && (
        <div>
          <label className="pv3-label">Actualizar existente (opcional)</label>
          <select
            className="pv3-input"
            style={{ marginTop: 5 }}
            value={existingNeedId}
            onChange={(e) => setExistingNeedId(e.target.value)}
          >
            <option value="">Nueva necesidad</option>
            {locationNeeds.map((n) => (
              <option key={n.id} value={n.id}>
                {n.item_name} ({n.qty_received}/{n.qty_required})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="pv3-label">Insumo</label>
        <input
          className="pv3-input"
          style={{ marginTop: 5 }}
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="Ej. colchonetas, leche infantil"
          required
        />
      </div>

      <div>
        <label className="pv3-label">Prioridad</label>
        <select
          className="pv3-input"
          style={{ marginTop: 5 }}
          value={priority}
          onChange={(e) => setPriority(e.target.value as NeedPriority)}
        >
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="pv3-label">Necesario</label>
          <input
            type="number"
            min={0}
            className="pv3-input"
            style={{ marginTop: 5 }}
            value={qtyRequired}
            onChange={(e) => setQtyRequired(e.target.value)}
          />
        </div>
        <div>
          <label className="pv3-label">Recibido</label>
          <input
            type="number"
            min={0}
            className="pv3-input"
            style={{ marginTop: 5 }}
            value={qtyReceived}
            onChange={(e) => setQtyReceived(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="pv3-label">Unidad</label>
        <input
          className="pv3-input"
          style={{ marginTop: 5 }}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>

      <div>
        <label className="pv3-label">Nota (opcional)</label>
        <textarea
          className="pv3-input"
          style={{ marginTop: 5, minHeight: 72, resize: 'vertical' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexto para quien va a donar"
        />
      </div>

      <button type="submit" className="pv3-btn pv3-btn--primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Guardando…' : 'Publicar actualización'}
      </button>
    </form>
  )
}
