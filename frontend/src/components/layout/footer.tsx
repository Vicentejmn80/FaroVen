export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="container py-4 sm:py-6">
        <p className="text-xs sm:text-sm text-muted-foreground text-center">
          Los datos mostrados provienen de fuentes oficiales verificadas.
          <br className="sm:hidden" />
          {' '}Ante cualquier duda, contacta a las autoridades locales.
        </p>
      </div>
    </footer>
  )
}
