import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { LEGAL_CHANGELOG } from '@/data/legal/documents'
import type { LegalDocument } from '@/domain/legal-models'
import { cn } from '@/lib/utils'

interface LegalDocumentScreenProps {
  document: LegalDocument
  onBack?: () => void
  showChangelog?: boolean
}

export function LegalDocumentScreen({ document, onBack, showChangelog = false }: LegalDocumentScreenProps) {
  const shouldShowChangelog =
    showChangelog || document.id === 'terms' || document.id === 'privacy' || document.id === 'notice'

  return (
    <ScreenScaffold title={document.title} subtitle={document.subtitle} onBack={onBack}>
      <div className="space-y-4 pt-2">
        <GlassCard inset={false} className="space-y-1 px-4 py-3">
          <p className="text-xs text-ink-subtle">
            <span className="font-medium text-ink-muted">Versión:</span> {document.version}
          </p>
          <p className="text-xs text-ink-subtle">
            <span className="font-medium text-ink-muted">Última actualización:</span> {document.updatedAt}
          </p>
          <p className="text-xs text-ink-subtle">
            <span className="font-medium text-ink-muted">Vigencia a partir de:</span> {document.effectiveAt}
          </p>
        </GlassCard>
        {document.sections.map((section) => (
          <GlassCard
            key={section.id}
            className={cn(
              'space-y-2',
              section.emphasis === 'warning' && 'border-warning/30 bg-warning/10',
              section.emphasis === 'info' && 'border-info/30 bg-info/10',
            )}
          >
            <p className="text-[15px] font-semibold text-ink">{section.title}</p>
            <p className="text-sm leading-relaxed text-ink-muted">{section.body}</p>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </GlassCard>
        ))}
        {shouldShowChangelog && (
          <GlassCard className="space-y-3">
            <p className="text-[15px] font-semibold text-ink">Historial de versiones</p>
            <div className="space-y-3">
              {LEGAL_CHANGELOG.map((entry) => (
                <div key={entry.version} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <p className="text-sm font-medium text-ink">
                    v{entry.version} <span className="text-xs font-normal text-ink-subtle">· {entry.date}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">{entry.title}</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-ink-subtle">
                    {entry.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </ScreenScaffold>
  )
}
