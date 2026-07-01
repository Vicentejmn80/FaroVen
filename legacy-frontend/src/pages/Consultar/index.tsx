import { Link } from 'react-router-dom'
import { ActionableInsights } from '@/components/home/actionable-insights'
import { Card, CardContent } from '@/components/ui/card'

const links = [
  { label: 'Necesidades', href: '/needs', icon: '⚡' },
  { label: 'Hospitales', href: '/hospitals', icon: '🏥' },
  { label: 'Centros de acopio', href: '/supply-centers', icon: '📦' },
  { label: 'Reportar error', href: '/report', icon: '⚠' },
]

export function ConsultarPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
          ← Volver al inicio
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold mt-2 mb-1">Consultar información</h1>
        <p className="text-sm text-muted-foreground">
          Revisa qué necesitan hospitales y centros de acopio verificados hoy.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {links.map((item) => (
          <Link key={item.href} to={item.href}>
            <Card className="hover:bg-accent transition-colors h-full">
              <CardContent className="py-4 flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <ActionableInsights />
    </div>
  )
}
