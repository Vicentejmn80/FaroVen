import { cn } from '@/lib/utils'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { REQUEST_SOURCE_LABELS } from '@/domain/case-lifecycle.types'

/** Visual de prioridad — borde lateral + punto (sin badge de texto). */
export function getPriorityVisual(priority: string, resolved = false) {
  if (resolved) {
    return { dot: '🔵', bar: 'bg-info shadow-[0_0_6px_rgba(56,132,255,0.35)]' }
  }
  switch (priority) {
    case 'critical':
    case 'high':
      return { dot: '🔴', bar: 'bg-critical shadow-[0_0_6px_rgba(239,68,68,0.4)]' }
    case 'medium':
      return { dot: '🟡', bar: 'bg-warning' }
    default:
      return { dot: '🟢', bar: 'bg-operational' }
  }
}

/** Quita prefijos E2E / Prioritario y separa recurso vs ubicación. */
export function cleanCaseTitle(raw: string): { headline: string; subline?: string } {
  let t = raw
    .replace(/^E2E\s*[—\-–]\s*/i, '')
    .replace(/^Prioritario:\s*/i, '')
    .trim()

  const enMatch = t.match(/^(.+?)\s+en\s+(.+)$/i)
  if (enMatch) {
    const headline = enMatch[1].replace(/^Necesidad de\s+/i, '').trim()
    return { headline, subline: enMatch[2].trim() }
  }

  const dashParts = t.split(/\s*[—–-]\s*/)
  if (dashParts.length >= 2) {
    return { headline: dashParts[0].trim(), subline: dashParts.slice(1).join(' — ').trim() }
  }

  return { headline: t.replace(/^Necesidad de\s+/i, '').trim() }
}

export function reporterShortLabel(caseItem: CaseDomain): string {
  if (caseItem.reporterInfo.name?.trim()) return caseItem.reporterInfo.name.trim()
  if (caseItem.requestSource === 'citizen') return 'Ciudadano'
  return REQUEST_SOURCE_LABELS[caseItem.requestSource] ?? 'Reportante'
}

export function parseCaseOpsSummary(caseItem: CaseDomain) {
  const { headline, subline } = cleanCaseTitle(caseItem.title)
  const desc = caseItem.description ?? ''

  const needMatch = desc.match(/Necesidad:\s*([^·\n]+)/i)
  const reqMatch = desc.match(/Requerido:\s*(\d+)\s*([\wáéíóúñ]+)?/i)
  const peopleMatch = desc.match(/Personas afectadas:\s*(\d+)/i)
  const peopleFromDesc = desc.match(/\[Aprox\.\s*(\d+)\s*personas/i)

  const narrative = desc
    .split(/\n\n\[FARO Wizard\]/i)[0]
    .split(/\[FARO Wizard\]/i)[0]
    .replace(/\n\n\[Aprox\.\s*\d+\s*personas[^\]]*\]/i, '')
    .trim()

  const resource =
    needMatch?.[1]?.trim() ||
    headline.replace(/^Necesidad de\s+/i, '').trim() ||
    caseItem.category ||
    headline

  const location =
    subline ||
    caseItem.location.address?.split(',')[0]?.trim() ||
    caseItem.location.zone ||
    caseItem.zone

  const quantity = reqMatch
    ? `${reqMatch[1]}${reqMatch[2] ? ` ${reqMatch[2]}` : ' unidades'}`
    : null

  const people =
    peopleMatch?.[1] != null
      ? Number(peopleMatch[1])
      : peopleFromDesc?.[1] != null
        ? Number(peopleFromDesc[1])
        : caseItem.affectedCount > 0
          ? caseItem.affectedCount
          : null

  return { resource, location, quantity, people, narrative }
}

export function shortenMissionHint(hint: string): string {
  const h = hint.toLowerCase()
  if (h.includes('camino') || h.includes('en_route') || h.includes('en ruta')) return '🚗 En camino'
  if (h.includes('sitio') || h.includes('lleg') || h.includes('on_site')) return '📍 En sitio'
  if (h.includes('complet') || h.includes('verific') || h.includes('entreg')) return '✅ Completado'
  if (h.includes('prepar')) return '⏳ Preparando'
  if (h.includes('progres') || h.includes('in_progress')) return '🔧 Ejecutando'
  const words = hint.trim().split(/\s+/).slice(0, 3).join(' ')
  return words.length > 18 ? `${words.slice(0, 16)}…` : words
}

export function CoverageProgressDots({
  accepted,
  required,
  className,
}: {
  accepted: number
  required: number
  className?: string
}) {
  const total = Math.max(required, 1)
  const ratio = Math.min(1, accepted / total)
  const filled = Math.max(accepted > 0 ? 1 : 0, Math.round(ratio * 4))

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              i < filled ? 'bg-info' : 'border border-white/25 bg-transparent',
            )}
          />
        ))}
      </div>
      <span className="truncate text-[11px] text-ink-muted/70">
        {accepted}/{required || '—'}{' '}
        {accepted === 1 ? 'voluntario' : 'voluntarios'}
      </span>
    </div>
  )
}

export function CoverageProgressBar({
  current,
  total,
  className,
}: {
  current: number
  total: number
  className?: string
}) {
  const max = Math.max(total, 1)
  const pct = Math.min(100, Math.round((current / max) * 100))

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">Cobertura</span>
        <span className="text-lg font-semibold tabular-nums text-ink">
          {current}
          <span className="text-sm font-normal text-ink-muted">/{total}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-info to-operational transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
