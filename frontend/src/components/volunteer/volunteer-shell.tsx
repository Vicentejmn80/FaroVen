import { Link } from 'react-router-dom'
import { useAuth } from '@/context/auth-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'

function emailInitials(email: string) {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return getInitials(parts[0], parts[1])
  }
  return local.slice(0, 2).toUpperCase()
}

export function VolunteerShell() {
  const { user, signOut } = useAuth()
  const email = user?.email ?? 'voluntario'

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-4 sm:p-5 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
            {emailInitials(email)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="font-semibold truncate">Coordinador en sitio</p>
              <Badge variant="success">Sesión activa</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/">
            <Button variant="outline" size="sm">
              Ver sitio público
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}
