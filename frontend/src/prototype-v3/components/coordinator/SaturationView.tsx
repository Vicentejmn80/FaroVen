import { useEffect, useState } from 'react'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useSiteSaturation, useUpdateSiteSaturation } from '@/hooks/useSiteSaturation'

interface SaturationViewProps {
  notify: (msg: string) => void
  onNeedSite: () => void
  onGoUpdate: () => void
}

export function SaturationView({ notify, onNeedSite, onGoUpdate }: SaturationViewProps) {
  const { data: profile, isLoading } = useCoordinatorProfile()
  const { data: notAccepts, isLoading: loadingItems } = useSiteSaturation()
  const mutation = useUpdateSiteSaturation()
  const [itemsText, setItemsText] = useState('')

  useEffect(() => {
    if (notAccepts) setItemsText(notAccepts.join(', '))
  }, [notAccepts])

  if (isLoading || loadingItems) {
    return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando…</p>
  }

  if (!profile) {
    return (
      <div className="pv3-card">
        <p style={{ fontSize: 13, color: '#5f6373', margin: '0 0 12px' }}>Configura tu sitio primero.</p>
        <button type="button" className="pv3-btn pv3-btn--primary" onClick={onNeedSite}>
          Configurar mi sitio
        </button>
      </div>
    )
  }

  if (profile.site_type !== 'supply_center') {
    return (
      <div className="pv3-card">
        <p style={{ fontSize: 13, color: '#5f6373', margin: '0 0 12px', lineHeight: 1.45 }}>
          En <strong>hospitales y refugios</strong>, la saturación se refleja cuando una necesidad
          llega al 100%. Actualiza las cantidades recibidas en Necesidades.
        </p>
        <button type="button" className="pv3-btn pv3-btn--primary" onClick={onGoUpdate}>
          Ir a necesidades
        </button>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync({ siteId: profile.site_id, itemsText })
      notify('Lista de saturación actualizada.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <p style={{ fontSize: 13, color: '#5f6373', margin: 0 }}>
        Centro: <strong>{profile.site_name}</strong> — indica qué <em>no</em> deben traer.
      </p>
      <div>
        <label className="pv3-label">Ya no recibimos (separado por comas)</label>
        <textarea
          className="pv3-input"
          style={{ marginTop: 5, minHeight: 90, resize: 'vertical' }}
          placeholder="Ej. cobijas, ropa usada, arroz"
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
        />
      </div>
      <button type="submit" className="pv3-btn pv3-btn--primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Guardando…' : 'Publicar alerta de saturación'}
      </button>
    </form>
  )
}
