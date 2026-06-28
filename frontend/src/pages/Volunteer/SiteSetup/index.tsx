import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCoordinatorProfile, useSaveCoordinatorSite } from '@/hooks/useCoordinatorProfile'
import { useSitesRegistry } from '@/hooks/useSitesRegistry'
import type { CoordinatorSiteType } from '@/lib/types'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { APP_NAME } from '@/lib/constants'

const SITE_TYPE_LABELS: Record<CoordinatorSiteType, string> = {
  hospital: 'Hospital',
  supply_center: 'Centro de acopio',
}

export function VolunteerSiteSetupPage() {
  const navigate = useNavigate()
  const { data: profile } = useCoordinatorProfile()
  const { data: registry, isLoading } = useSitesRegistry()
  const saveSite = useSaveCoordinatorSite()

  const [siteType, setSiteType] = useState<CoordinatorSiteType>(profile?.site_type ?? 'supply_center')
  const [search, setSearch] = useState(profile?.site_name ?? '')
  const [registerNew, setRegisterNew] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredSites = useMemo(() => {
    const list = (registry ?? []).filter((s) => s.type === siteType)
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) => s.name.toLowerCase().includes(q))
  }, [registry, siteType, search])

  const exactMatch = useMemo(
    () => filteredSites.find((s) => s.name.toLowerCase() === search.trim().toLowerCase()),
    [filteredSites, search]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      if (registerNew || !exactMatch) {
        await saveSite.mutateAsync({
          site_type: siteType,
          new_site_name: search.trim(),
        })
      } else {
        await saveSite.mutateAsync({
          site_type: siteType,
          site_id: exactMatch.id,
        })
      }
      navigate('/volunteer', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el sitio')
    }
  }

  if (isLoading) {
    return (
      <div className="py-16">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <Badge variant="info" className="mb-3">{APP_NAME} · Coordinador</Badge>
        <h1 className="text-lg sm:text-xl font-bold mb-2">¿Dónde coordinas hoy?</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Elige tu hospital o centro de acopio. Si ya existe en la lista, selecciónalo. Si no,
          regístralo — el próximo coordinador del mismo sitio solo lo elige.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu sitio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SITE_TYPE_LABELS) as CoordinatorSiteType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSiteType(type)
                    setSearch('')
                    setRegisterNew(false)
                  }}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                    siteType === type
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {type === 'hospital' ? '🏥' : '📦'} {SITE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="site-search" className="label block mb-1.5">
                Nombre del {SITE_TYPE_LABELS[siteType].toLowerCase()}
              </label>
              <Input
                id="site-search"
                list="sites-list"
                placeholder="Ej: Hospital Miguel Pérez Carreño"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setRegisterNew(false)
                }}
                required
              />
              <datalist id="sites-list">
                {filteredSites.map((site) => (
                  <option key={site.id} value={site.name} />
                ))}
              </datalist>
            </div>

            {search.trim() && !exactMatch && (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
                No encontramos &quot;{search.trim()}&quot; en la lista. Al guardar, quedará registrado
                para que otros coordinadores lo seleccionen después.
              </p>
            )}

            {exactMatch && (
              <p className="text-xs text-primary">
                ✓ Sitio existente: {exactMatch.name}
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={saveSite.isPending || !search.trim()}>
              {saveSite.isPending ? 'Guardando...' : profile ? 'Actualizar mi sitio' : 'Confirmar y entrar al panel'}
            </Button>

            {profile && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/volunteer')}>
                Cancelar
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
