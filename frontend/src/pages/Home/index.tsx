import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { APP_NAME, APP_ICON, APP_TAGLINE } from '@/lib/constants'

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-2">
      <div className="text-center mb-10 w-full max-w-lg">
        <div className="text-5xl mb-4">{APP_ICON}</div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
        <p className="text-xs text-muted-foreground mt-2">¿Qué quieres hacer hoy?</p>
      </div>

      <div className="w-full max-w-lg grid sm:grid-cols-2 gap-3">
        <Link to="/consultar" className="block h-full">
          <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors h-full">
            <CardContent className="py-8 text-center h-full flex flex-col items-center justify-center">
              <span className="text-4xl mb-3">🔍</span>
              <p className="font-bold text-lg mb-1">Consultar</p>
              <p className="text-sm text-muted-foreground">
                Buscar necesidades y dónde ayudar
              </p>
              <p className="text-xs text-primary mt-3">Sin cuenta</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/auth?redirect=/volunteer" className="block h-full">
          <Card className="hover:bg-accent transition-colors h-full">
            <CardContent className="py-8 text-center h-full flex flex-col items-center justify-center">
              <span className="text-4xl mb-3">🛠</span>
              <p className="font-bold text-lg mb-1">Coordinador</p>
              <p className="text-sm text-muted-foreground">
                Actualizar hospital o centro de acopio
              </p>
              <p className="text-xs text-muted-foreground mt-3">Correo + enlace</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Link to="/links" className="text-xs text-primary hover:underline mt-8">
        Enlace para Instagram / WhatsApp
      </Link>
    </div>
  )
}
