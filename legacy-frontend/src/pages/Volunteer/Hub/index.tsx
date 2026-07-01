import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FieldGuide } from '@/components/volunteer/field-guide'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useLocationNeeds } from '@/hooks/useQuickUpdate'
import { useAuth } from '@/context/auth-provider'
import { useIsAdmin } from '@/hooks/useAdmin'

const actions = [
  {
    title: 'Agregar o actualizar necesidad',
    description: 'Publica qué falta, cuánto tienen y una nota de contexto para quien va a ayudar.',
    href: '/volunteer/actualizar',
    cta: 'Abrir formulario',
    icon: '⚡',
    primary: true,
  },
  {
    title: 'Evitar saturar',
    description: 'Marca insumos que ya no deben traer (acopio) o sube necesidades al 100% (hospital).',
    href: '/volunteer/saturacion',
    cta: 'Gestionar saturación',
    icon: '⛔',
    primary: false,
  },
  {
    title: 'Publicar boletín verificado',
    description: 'Aviso flash con fuente para WhatsApp e Instagram.',
    href: '/volunteer/boletin',
    cta: 'Crear boletín',
    icon: '📢',
    primary: false,
  },
]

export function VolunteerHubPage() {
  const { user } = useAuth()
  const { data: profile } = useCoordinatorProfile()
  const { data: siteNeeds } = useLocationNeeds(profile?.site_type, profile?.site_id)
  const { data: isAdmin } = useIsAdmin()
  const needCount = siteNeeds?.length ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg sm:text-xl font-bold mb-1">Panel de coordinación</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido{user?.email ? `, ${user.email.split('@')[0]}` : ''}. Tú mantienes al día la
          información de tu sitio — quien consulta solo lee.
        </p>
      </div>

      {profile && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Coordinando en</p>
              <p className="font-semibold">
                {profile.site_type === 'hospital' ? '🏥' : '📦'} {profile.site_name}
              </p>
            </div>
            <Link to="/volunteer/sitio?edit=1" className="text-xs text-primary hover:underline">
              Cambiar
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary">{needCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Necesidades activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Badge variant="success" className="mb-1">
              Activo
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Tu sesión</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 mb-6">
        {actions.map((action) => (
          <Card
            key={action.href}
            className={action.primary ? 'border-primary/30 bg-primary/5' : undefined}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{action.icon}</span>
                {action.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
              <Link to={action.href}>
                <Button className="w-full" variant={action.primary ? 'default' : 'outline'}>
                  {action.cta}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-orange-700 font-semibold uppercase tracking-wide">Administrador</p>
              <p className="text-sm font-medium mt-0.5">Tienes acceso al panel de moderación</p>
            </div>
            <Link to="/admin">
              <Button size="sm" variant="outline">Panel admin</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <FieldGuide />
    </div>
  )
}
