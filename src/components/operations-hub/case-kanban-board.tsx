import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Search } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import { OPS_BOARD_COLUMNS, type OpsBoardColumnId } from '@/domain/ops-pipeline'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { PublicNeed } from '@/domain/public-need.types'
import {
  cleanCaseTitle,
  CoverageProgressDots,
  getPriorityVisual,
  parseCaseOpsSummary,
  reporterShortLabel,
  shortenMissionHint,
} from '@/components/operations-hub/case-ops-display'

/** Columnas del pipeline operacional COE (sin drag — movimiento automático por dominio). */
export const KANBAN_COLUMNS = OPS_BOARD_COLUMNS.map((col) => ({
  id: col.id,
  label: col.label,
  description: col.description,
  stages: col.stages as PipelineStage[],
  accent: col.accent,
  header: col.header,
}))

export type KanbanColumnId = OpsBoardColumnId

interface CaseKanbanBoardProps {
  cases: CaseDomain[]
  needs?: PublicNeed[]
  selectedId: string | null
  onSelect: (c: CaseDomain) => void
  /** Último evento de misión por caseId (timeline vivo en En progreso). */
  liveMissionHints?: Record<string, string>
  className?: string
}

interface CaseCardMetrics {
  needs: number
  covered: number
  pending: number
  volunteersAccepted: number
  volunteersRequired: number
  callStatus: string
}

export function CaseKanbanBoard({
  cases,
  needs = [],
  selectedId,
  onSelect,
  liveMissionHints = {},
  className,
}: CaseKanbanBoardProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return cases
    const q = query.toLowerCase()
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.zone.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.reporterInfo.name ?? '').toLowerCase().includes(q),
    )
  }, [cases, query])

  const byColumn = useMemo(() => {
    const map = new Map<KanbanColumnId, CaseDomain[]>()
    for (const col of KANBAN_COLUMNS) {
      map.set(
        col.id,
        filtered.filter((c) => (col.stages as readonly PipelineStage[]).includes(c.pipelineStage)),
      )
    }
    return map
  }, [filtered])

  const metricsByCase = useMemo(() => {
    const map = new Map<string, CaseCardMetrics>()
    for (const need of needs) {
      if (!need.caseId) continue
      const current = map.get(need.caseId) ?? {
        needs: 0,
        covered: 0,
        pending: 0,
        volunteersAccepted: 0,
        volunteersRequired: 0,
        callStatus: 'closed',
      }
      current.needs += 1
      const isCovered = need.status === 'completed' || need.remainingQuantity <= 0
      if (isCovered) current.covered += 1
      else current.pending += 1
      current.volunteersAccepted += Number(need.coveredQuantity || 0)
      current.volunteersRequired += Number(need.requiredQuantity || 0)
      if (need.callStatus === 'open') current.callStatus = 'open'
      if (need.callStatus === 'complete' && current.callStatus !== 'open') current.callStatus = 'complete'
      map.set(need.caseId, current)
    }
    return map
  }, [needs])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="shrink-0 px-3 pb-2 pt-2 lg:px-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el flujo operacional…"
            className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-2 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-info/40"
          />
        </div>
        <p className="mt-1.5 text-[10px] text-ink-faint">
          Las columnas son estados del ciclo de vida. El movimiento es automático — sin arrastre manual.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-2 pb-3 lg:px-3">
        <div className="flex h-full min-w-max gap-2.5 lg:gap-3">
          {KANBAN_COLUMNS.map((col) => {
            const items = byColumn.get(col.id) ?? []
            return (
              <section
                key={col.id}
                className={cn(
                  'flex w-[min(280px,78vw)] shrink-0 flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] border-t-2',
                  col.accent,
                )}
              >
                <header className="border-b border-white/[0.05] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', col.header)}>
                      {col.label}
                    </h3>
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-muted">
                      {items.length}
                    </span>
                  </div>
                  {'description' in col && col.description ? (
                    <p className="mt-0.5 text-[10px] leading-snug text-ink-faint">{col.description}</p>
                  ) : null}
                </header>

                <ScrollArea className="min-h-0 flex-1 px-2 py-2">
                  <div className="space-y-2 pb-2">
                    {items.map((c, i) => (
                      <KanbanCard
                        key={c.id}
                        caseItem={c}
                        metrics={metricsByCase.get(c.id)}
                        liveHint={liveMissionHints[c.id]}
                        columnId={col.id}
                        selected={c.id === selectedId}
                        onSelect={() => onSelect(c)}
                        index={i}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-6 text-center">
                        <p className="text-[11px] text-ink-muted">Sin casos</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KanbanCard({
  caseItem,
  metrics,
  liveHint,
  columnId,
  selected,
  onSelect,
  index,
}: {
  caseItem: CaseDomain
  metrics?: CaseCardMetrics
  liveHint?: string
  columnId: KanbanColumnId
  selected: boolean
  onSelect: () => void
  index: number
}) {
  const resolved = columnId === 'resuelto'
  const priority = getPriorityVisual(caseItem.priority, resolved)
  const awaitingInfo = caseItem.pipelineStage === 'awaiting_info'
  const { headline, subline } = cleanCaseTitle(caseItem.title)
  const ops = parseCaseOpsSummary(caseItem)
  const title = ops.resource || headline
  const location = ops.location || subline || caseItem.zone
  const reporter = reporterShortLabel(caseItem)
  const showCoverage =
    metrics &&
    (columnId === 'esperando_cobertura' ||
      columnId === 'en_progreso' ||
      columnId === 'en_revision')
  const volunteersAccepted = metrics?.volunteersAccepted ?? 0
  const volunteersRequired = metrics?.volunteersRequired ?? 0

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all',
        'bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-md',
        selected
          ? 'border-info/40 ring-1 ring-info/25 shadow-[0_0_20px_rgba(56,132,255,0.12)]'
          : 'border-white/[0.08] hover:border-white/[0.14] hover:from-white/[0.09]',
      )}
    >
      <span className={cn('absolute left-0 top-0 h-full w-[3px]', priority.bar)} />

      <div className="flex min-w-0 items-center gap-1.5 pl-1">
        <span className="shrink-0 text-[11px] leading-none" aria-hidden>
          {priority.dot}
        </span>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-ink">
          {title}
        </p>
      </div>

      {location && (
        <p className="mt-1 truncate pl-[22px] text-[13px] font-medium leading-snug text-ink/90">
          {location}
        </p>
      )}

      <div className="mt-2 space-y-1.5 pl-[22px]">
        <p className="truncate text-[12px] text-ink-muted/60">
          <span>📍 {caseItem.zone}</span>
          <span className="mx-1.5 text-ink-faint/50">·</span>
          <span>👤 {reporter}</span>
        </p>
        <p className="text-[12px] text-ink-muted/60">🕐 {timeAgo(caseItem.createdAt)}</p>
      </div>

      {awaitingInfo && (
        <p className="mt-2 flex items-center gap-1 pl-[22px] text-[11px] text-warning">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
          Falta información
        </p>
      )}

      {showCoverage && volunteersRequired > 0 && (
        <div className="mt-2 pl-[22px]">
          <CoverageProgressDots accepted={volunteersAccepted} required={volunteersRequired} />
        </div>
      )}

      {columnId === 'en_progreso' && liveHint && (
        <p className="mt-2 truncate pl-[22px] text-[11px] font-medium text-operational">
          {shortenMissionHint(liveHint)}
        </p>
      )}

      {resolved && (
        <p className="mt-2 pl-[22px] text-[11px] font-medium text-info">✅ Resuelto</p>
      )}
    </motion.button>
  )
}
