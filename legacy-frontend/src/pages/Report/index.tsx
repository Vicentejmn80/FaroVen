import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useCreateReport } from '@/hooks/useReport'
import { REPORT_TYPE_LABELS, type ReportType } from '@/lib/types'

const REPORT_TYPES = Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function ReportPage() {
  const [searchParams] = useSearchParams()
  const personId = searchParams.get('person_id')

  const [type, setType] = useState<ReportType | ''>('')
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const mutation = useCreateReport()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type || !description.trim()) return

    try {
      await mutation.mutateAsync({
        type: type as ReportType,
        description: description.trim(),
        person_id: personId,
        reported_by: name.trim() || undefined,
        contact_info: email.trim() || undefined,
      })
      setSubmitted(true)
    } catch {
      // Error handled by mutation state
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <span className="text-5xl mb-4 block">✅</span>
        <h1 className="text-xl font-bold mb-2">Reporte enviado</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Gracias por tu contribución. Tu reporte será revisado por nuestro equipo
          antes de realizar cualquier cambio en la plataforma.
        </p>
        <p className="text-xs text-muted-foreground">
          Número de reporte: {mutation.data ?? 'generado automáticamente'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg sm:text-xl font-bold mb-2">Reportar Error</h1>
      <p className="text-sm text-muted-foreground mb-6">
        ¿Encontraste información incorrecta? Reportalo aquí.
        Tu reporte será revisado por nuestro equipo antes de aplicar cualquier cambio.
      </p>

      <Card>
        <CardContent className="py-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="type" className="label block mb-1.5">
                Tipo de reporte
              </label>
              <Select
                id="type"
                options={REPORT_TYPES}
                placeholder="Selecciona un tipo"
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
              />
            </div>

            <div>
              <label htmlFor="description" className="label block mb-1.5">
                Describe el error
              </label>
              <textarea
                id="description"
                className="input min-h-[100px] resize-y"
                placeholder="Ej: La persona María García ya fue localizada y está en su domicilio..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="name" className="label block mb-1.5">
                  Tu nombre <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="email" className="label block mb-1.5">
                  Tu email <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              ℹ️ Los reportes son revisados por nuestro equipo antes de aplicar cambios.
              No compartimos tu información con terceros.
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!type || !description.trim() || mutation.isPending}
            >
              {mutation.isPending ? 'Enviando...' : 'Enviar Reporte'}
            </Button>

            {mutation.isError && (
              <p className="text-sm text-destructive text-center">
                Error al enviar el reporte. Intenta de nuevo.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
