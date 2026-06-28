import { Card, CardContent } from '@/components/ui/card'

export function TrustBanner() {
  return (
    <Card className="border-primary/20 bg-primary/5 w-full">
      <CardContent className="py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Información verificada, no rumores</p>
        <p>
          Solo mostramos sitios ancla con fuente y hora. Si un dato tiene más de 12–24 h sin
          confirmar, se marca como desactualizado. Verifica antes de mover ayuda.
        </p>
      </CardContent>
    </Card>
  )
}
