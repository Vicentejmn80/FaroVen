import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useLocationNeeds, useQuickUpdate } from '@/hooks/useQuickUpdate'
import type { NeedPriority } from '@/lib/types'
import { PRIORITY_LABELS } from '@/lib/types'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function VolunteerQuickUpdatePage() {
  const { data: profile, isLoading: profileLoading } = useCoordinatorProfile()
  const [existingNeedId, setExistingNeedId] = useState('')
  const [itemName, setItemName] = useState('')
  const [priority, setPriority] = useState<NeedPriority>('high')
  const [qtyRequired, setQtyRequired] = useState('100')
  const [qtyReceived, setQtyReceived] = useState('0')
  const [unit, setUnit] = useState('unidades')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const siteType = profile?.site_type
  const siteId = profile?.site_id

  const { data: locationNeeds } = useLocationNeeds(siteType, siteId)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siteType || !siteId || !itemName.trim()) return

    await mutation.mutateAsync({
      needable_type: siteType,
      needable_id: siteId,
      item_name: itemName.trim(),
      priority,
      qty_required: Number(qtyRequired) || 0,
      qty_received: Number(qtyReceived) || 0,
      unit: unit.trim() || 'unidades',
      notes: notes.trim() || undefined,
      existing_need_id: existingNeedId || undefined,
    })

    setSubmitted(true)
  }

  if (profileLoading) {
    return (
      <div className="py-16">
        <LoadingSpinner />
      </div>
    )
  }

  if (!profile) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Primero indica tu sitio en{' '}
        <Link to="/volunteer/sitio" className="text-primary hover:underline">
          configuración de sitio
        </Link>
        .
      </p>
    )
  }

  if (submitted) {
    return (
      <div className="text-center py-10">
        <span className="text-5xl mb-4 block">✅</span>
        <h1 className="text-xl font-bold mb-2">Actualización guardada</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Ya aparece en Necesidades con tu nota y marca de tiempo. Cuando llegue ayuda al sitio,
          vuelve y sube la cantidad recibida.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/volunteer">
            <Button>Volver al panel</Button>
          </Link>
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Agregar otra necesidad
          </Button>
        </div>
      </div>
    )
  }

  const siteIcon = profile.site_type === 'hospital' ? '🏥' : '📦'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg sm:text-xl font-bold mb-1">Actualizar necesidades</h1>
        <p className="text-sm text-muted-foreground">
          Solo tú, desde el sitio, mantienes estos números al día. Quien consulta no los llena.
        </p>
      </div>

      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Tu sitio</p>
            <p className="font-semibold">
              {siteIcon} {profile.site_name}
            </p>
          </div>
          <Link to="/volunteer/sitio?edit=1" className="text-xs text-primary hover:underline shrink-0">
            Cambiar sitio
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Qué necesita el sitio hoy?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {locationNeeds && locationNeeds.length > 0 && (
              <div>
                <label htmlFor="existing" className="label block mb-1.5">
                  Actualizar necesidad existente (opcional)
                </label>
                <Select
                  id="existing"
                  options={[
                    { value: '', label: 'Nueva necesidad' },
                    ...locationNeeds.map((n) => ({
                      value: n.id,
                      label: `${n.item_name} (${n.qty_received}/${n.qty_required})`,
                    })),
                  ]}
                  value={existingNeedId}
                  onChange={(e) => setExistingNeedId(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="item" className="label block mb-1.5">
                Necesidad
              </label>
              <Input
                id="item"
                placeholder="Ej: Sábanas, colchonetas, guantes"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="priority" className="label block mb-1.5">
                  Prioridad
                </label>
                <Select
                  id="priority"
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as NeedPriority)}
                />
              </div>
              <div>
                <label htmlFor="unit" className="label block mb-1.5">
                  Unidad
                </label>
                <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="required" className="label block mb-1.5">
                  Necesitan (meta)
                </label>
                <Input
                  id="required"
                  type="number"
                  min="0"
                  value={qtyRequired}
                  onChange={(e) => setQtyRequired(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="received" className="label block mb-1.5">
                  Ya tienen
                </label>
                <Input
                  id="received"
                  type="number"
                  min="0"
                  value={qtyReceived}
                  onChange={(e) => setQtyReceived(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="label block mb-1.5">
                Nota para quien consulta (opcional)
              </label>
              <textarea
                id="notes"
                className="input min-h-[90px] resize-y"
                placeholder='Ej: "Antes faltaban cobijas y ya saturaron. Entraron refugiados nuevos y ahora hace falta colchonetas."'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aparece desplegable en la página pública. Actualiza cuando cambie la situación.
              </p>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : 'Publicar necesidad'}
            </Button>

            {mutation.isError && (
              <p className="text-sm text-destructive text-center">
                No se pudo guardar. ¿Corriste la migración de coordinadores en Supabase?
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
