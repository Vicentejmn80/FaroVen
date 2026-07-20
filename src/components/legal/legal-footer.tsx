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
    <footer className="border-t border-white/[0.06] bg-base-900/70 px-4 pb-20 pt-5 text-sm text-ink-muted lg:px-8 lg:pb-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <FooterLink label="Términos de Servicio" onClick={onOpenTerms} />
          <FooterLink label="Política de Privacidad" onClick={onOpenPrivacy} />
          <FooterLink label="Política de Cookies" onClick={onOpenCookies} />
          <FooterLink label="Aviso Legal" onClick={onOpenNotice} />
          <FooterLink label="Contacto" onClick={onOpenContact} />
          <FooterLink label="Acerca de FARO" onClick={onOpenAbout} />
        </div>
        {version && <span className="text-xs text-ink-subtle">Versión {version}</span>}
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
