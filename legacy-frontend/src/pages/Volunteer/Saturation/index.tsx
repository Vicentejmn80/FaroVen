import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useSiteSaturation, useUpdateSiteSaturation } from '@/hooks/useSiteSaturation'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export function VolunteerSaturationPage() {
  const { data: profile, isLoading: profileLoading } = useCoordinatorProfile()
  const { data: notAccepts, isLoading } = useSiteSaturation()
  const mutation = useUpdateSiteSaturation()
  const [itemsText, setItemsText] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (notAccepts) {
      setItemsText(notAccepts.join(', '))
    }
  }, [notAccepts])

  if (profileLoading || isLoading) {
    return (
      <div className="py-16">
        <LoadingSpinner />
      </div>
    )
  }

  if (!profile) {
    return (
      <p className="text-center text-muted-foreground py-8">
        <Link to="/volunteer/sitio" className="text-primary hover:underline">
          Configura tu sitio
        </Link>{' '}
        primero.
      </p>
    )
  }

  if (profile.site_type !== 'supply_center') {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Evitar saturar</h1>
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            <p className="mb-3">
              En <strong>hospitales</strong>, la saturación se refleja automáticamente cuando una
              necesidad llega al 100% (ej. cobijas 100/100).
            </p>
            <p>
              Actualiza la cantidad recibida en{' '}
              <Link to="/volunteer/actualizar" className="text-primary hover:underline">
                Necesidades
              </Link>{' '}
              y aparecerá en &quot;Evitar saturar&quot; para quien consulta.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    await mutation.mutateAsync({ siteId: profile.site_id, itemsText })
    setSaved(true)
  }

  const handleClear = async () => {
    setItemsText('')
    setSaved(false)
    await mutation.mutateAsync({ siteId: profile.site_id, itemsText: '' })
    setSaved(true)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg sm:text-xl font-bold mb-1">Evitar saturar</h1>
        <p className="text-sm text-muted-foreground">
          Indica qué <strong>no</strong> deben traer donantes a{' '}
          <strong>{profile.site_name}</strong>. Aparece en la consulta pública.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ya no recibimos (o tenemos de más)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="not-accepts" className="label block mb-1.5">
                Insumos saturados
              </label>
              <textarea
                id="not-accepts"
                className="input min-h-[100px] resize-y"
                placeholder="Ej: cobijas, ropa usada, arroz"
                value={itemsText}
                onChange={(e) => {
                  setItemsText(e.target.value)
                  setSaved(false)
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separa con comas. Ej: &quot;cobijas, agua embotellada&quot;
              </p>
            </div>

            {mutation.isError && (
              <p className="text-sm text-destructive">
                No se pudo guardar. ¿Corriste la migración 161000 en Supabase?
              </p>
            )}
            {saved && (
              <p className="text-sm text-primary">Guardado. Ya se ve en Consultar → Evitar saturar.</p>
            )}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : 'Publicar alerta de saturación'}
            </Button>
            {itemsText.trim() && (
              <Button type="button" variant="ghost" className="w-full" onClick={handleClear}>
                Limpiar lista (ya no hay exceso)
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
