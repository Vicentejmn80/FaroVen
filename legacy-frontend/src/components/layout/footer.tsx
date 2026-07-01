import { APP_NAME } from '@/lib/constants'

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="container py-4 sm:py-6">
        <p className="text-xs sm:text-sm text-muted-foreground text-center">
          <strong className="text-foreground">{APP_NAME}</strong> — datos verificados por coordinadores en sitio.
          <br className="sm:hidden" />
          {' '}Ante duda, confirma con el centro antes de mover ayuda.
        </p>
      </div>
    </footer>
  )
}
