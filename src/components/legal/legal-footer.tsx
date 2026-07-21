import { ExternalLink } from 'lucide-react'
import { formatBuildVersion } from '@/lib/build-info'

interface LegalFooterProps {
  onOpenTerms: () => void
  onOpenPrivacy: () => void
  onOpenNotice: () => void
  onOpenCookies: () => void
  onOpenContact: () => void
  onOpenAbout: () => void
}

/**
 * Footer legal — solo desktop.
 * En móvil los documentos viven en el Centro de Ayuda (?) para no restar viewport.
 */
export function LegalFooter({
  onOpenTerms,
  onOpenPrivacy,
  onOpenNotice,
  onOpenCookies,
  onOpenContact,
  onOpenAbout,
}: LegalFooterProps) {
  const version = formatBuildVersion()

  return (
    <footer className="hidden border-t border-white/[0.06] bg-base-900/70 px-8 py-4 text-sm text-ink-muted lg:block">
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FooterLink label="Términos de Servicio" onClick={onOpenTerms} />
          <FooterLink label="Política de Privacidad" onClick={onOpenPrivacy} />
          <FooterLink label="Política de Cookies" onClick={onOpenCookies} />
          <FooterLink label="Aviso Legal" onClick={onOpenNotice} />
          <FooterLink label="Contacto" onClick={onOpenContact} />
          <FooterLink label="Acerca de FARO" onClick={onOpenAbout} />
        </div>
        {version && <span className="shrink-0 text-xs text-ink-subtle">Versión {version}</span>}
      </div>
    </footer>
  )
}

function FooterLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
