import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateBulletin } from '@/hooks/useBulletins'
import type { BulletinKind, ConfidenceLevel } from '@/lib/types'
import { CONFIDENCE_LABELS } from '@/lib/types'

const KIND_OPTIONS = [
  { value: 'person_update', label: 'Actualización de persona' },
  { value: 'need_alert', label: 'Alerta de necesidad' },
  { value: 'distribution', label: 'Distribución / saturación' },
  { value: 'general', label: 'Aviso general' },
]

const CONFIDENCE_OPTIONS = Object.entries(CONFIDENCE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function VolunteerBulletinPage() {
  const [kind, setKind] = useState<BulletinKind>('general')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [confidence, setConfidence] = useState<ConfidenceLevel>('high')
  const [submitted, setSubmitted] = useState(false)

  const mutation = useCreateBulletin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !sourceName.trim()) return

    await mutation.mutateAsync({
      kind,
      title: title.trim(),
      body: body.trim(),
      source_name: sourceName.trim(),
      confidence,
    })

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="text-center py-10">
        <span className="text-5xl mb-4 block">📢</span>
        <h1 className="text-xl font-bold mb-2">Boletín publicado</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Ya aparece en la portada pública con fuente y hora. Puedes compartirlo en WhatsApp o Instagram.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/volunteer">
            <Button>Volver al panel</Button>
          </Link>
          <Link to="/">
            <Button variant="outline">Ver portada pública</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg sm:text-xl font-bold mb-1">Boletín verificado</h1>
        <p className="text-sm text-muted-foreground">
          Usa lenguaje verificable. Evita “confirmado” si no tienes fuente directa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo aviso flash</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="kind" className="label block mb-1.5">Tipo</label>
              <Select
                id="kind"
                options={KIND_OPTIONS}
                value={kind}
                onChange={(e) => setKind(e.target.value as BulletinKind)}
              />
            </div>

            <div>
              <label htmlFor="title" className="label block mb-1.5">Título corto</label>
              <Input
                id="title"
                placeholder="Ej: Actualización verificada"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="body" className="label block mb-1.5">Mensaje</label>
              <textarea
                id="body"
                className="input min-h-[100px] resize-y"
                placeholder="Ej: Parque del Este · faltan cunas · Fuente: coordinación local"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="source" className="label block mb-1.5">Fuente</label>
              <Input
                id="source"
                placeholder="Ej: Hospital / Cruz Roja / Coordinador del sitio"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="confidence" className="label block mb-1.5">Nivel de confianza</label>
              <Select
                id="confidence"
                options={CONFIDENCE_OPTIONS}
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Publicando...' : 'Publicar boletín'}
            </Button>

            {mutation.isError && (
              <p className="text-sm text-destructive text-center">
                No se pudo publicar. Verifica permisos de voluntario en Supabase.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
