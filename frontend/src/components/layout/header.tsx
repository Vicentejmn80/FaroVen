import { Link } from 'react-router-dom'
import { useAuth } from '@/context/auth-provider'
import { APP_NAME } from '@/lib/constants'
import { Button } from '@/components/ui/button'

export function Header() {
  const { session, loading } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 font-bold text-sm shrink-0">
          <span className="text-primary text-lg">⚠</span>
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/consultar">
            <Button size="sm" variant="ghost" className="text-xs sm:text-sm">
              Consultar
            </Button>
          </Link>
          {!loading && session ? (
            <Link to="/volunteer">
              <Button size="sm" className="text-xs sm:text-sm">
                Mi panel
              </Button>
            </Link>
          ) : (
            <Link to="/auth?redirect=/volunteer">
              <Button size="sm" variant="outline" className="text-xs sm:text-sm">
                Coordinador
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
