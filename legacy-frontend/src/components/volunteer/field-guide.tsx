import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const steps = [
  'Registra tu hospital o centro de acopio la primera vez (otros coordinadores lo seleccionarán después).',
  'Publica necesidades con cantidad (ej. sábanas 0/100) y una nota de contexto si hace falta.',
  'Cuando llegue ayuda al sitio, sube "ya tienen" — quien consulta no lo hace por ti.',
  'Si pasaron más de 24 h sin actualizar, el dato se marca como probablemente desactualizado.',
]

export function FieldGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cómo mantener datos útiles</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
          {steps.map((step) => (
            <li key={step} className="leading-relaxed">
              {step}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
