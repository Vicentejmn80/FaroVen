import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Search, Trash2 } from 'lucide-react'
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
} from '@/components/operations-hub/case-ops-display'
import {
  buildKanbanTimeline,
  type CaseMissionLive,
} from '@/domain/kanban-mission-timeline'

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
  /** Postulaciones pendientes (pending/under_review) por caseId. */
  pendingApplicationsByCase?: Record<string, number>
  /** Verificaciones pendientes (assignment completed, caso no resuelto) por caseId. */
  pendingVerificationsByCase?: Record<string, number>
  /** Misión en vivo por caseId (timeline en EN PROGRESO). */
  missionLiveByCase?: Record<string, CaseMissionLive>
  /** Eventos de misión no vistos por el GC. */
  unseenMissionEventsByCase?: Record<string, number>
  /** Eliminar caso por completo del backend. */
  onDelete?: (c: CaseDomain) => void
  deletingCaseId?: string | null
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
  pendingApplicationsByCase = {},
  pendingVerificationsByCase = {},
  missionLiveByCase = {},
  unseenMissionEventsByCase = {},
  onDelete,
  deletingCaseId = null,
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
                        missionLive={missionLiveByCase[c.id]}
                        pendingApplications={pendingApplicationsByCase[c.id] ?? 0}
                        pendingVerifications={pendingVerificationsByCase[c.id] ?? 0}
                        unseenEvents={unseenMissionEventsByCase[c.id] ?? 0}
                        columnId={col.id}
                        selected={c.id === selectedId}
                        onSelect={() => onSelect(c)}
                        onDelete={onDelete ? () => onDelete(c) : undefined}
                        isDeleting={deletingCaseId === c.id}
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
  missionLive,
  pendingApplications,
  pendingVerifications,
  unseenEvents,
  columnId,
  selected,
  onSelect,
  onDelete,
  isDeleting,
  index,
}: {
  caseItem: CaseDomain
  metrics?: CaseCardMetrics
  missionLive?: CaseMissionLive
  pendingApplications: number
  pendingVerifications: number
  unseenEvents: number
  columnId: KanbanColumnId
  selected: boolean
  onSelect: () => void
  onDelete?: () => void
  isDeleting?: boolean
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
    (columnId === 'esperando_cobertura' || columnId === 'en_revision')
  const volunteersAccepted = metrics?.volunteersAccepted ?? 0
  const volunteersRequired = metrics?.volunteersRequired ?? 0

  const showAppBadge = pendingApplications > 0 && !resolved
  const showVerifyBadge = pendingVerifications > 0 && !resolved
  const showUnseenBadge = unseenEvents > 0 && columnId === 'en_progreso' && !showVerifyBadge

  const timeline =
    columnId === 'en_progreso' && missionLive
      ? buildKanbanTimeline(missionLive.assignmentStatus, {
          delayMinutes: missionLive.delayMinutes,
        })
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border transition-all',
        'bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-md',
        selected
          ? 'border-info/40 ring-1 ring-info/25 shadow-[0_0_20px_rgba(56,132,255,0.12)]'
          : 'border-white/[0.08] hover:border-white/[0.14] hover:from-white/[0.09]',
        isDeleting && 'pointer-events-none opacity-60',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="relative w-full px-3 py-2.5 text-left"
      >
      <span className={cn('pointer-events-none absolute left-0 top-0 h-full w-[3px]', priority.bar)} />

      {(showAppBadge || showVerifyBadge || showUnseenBadge) && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          {showAppBadge && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold tabular-nums text-white shadow-sm"
              title={`${pendingApplications} postulación(es) pendiente(s)`}
              aria-label={`${pendingApplications} postulaciones pendientes`}
            >
              {pendingApplications > 9 ? '9+' : pendingApplications}
            </span>
          )}
          {showUnseenBadge && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold tabular-nums text-white shadow-sm"
              title={`${unseenEvents} actualización(es) de misión`}
              aria-label={`${unseenEvents} actualizaciones pendientes`}
            >
              {unseenEvents > 9 ? '9+' : unseenEvents}
            </span>
          )}
          {showVerifyBadge && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold tabular-nums text-[#1a1200] shadow-sm"
              title="Entregado — necesita validación"
              aria-label="Verificación pendiente"
            >
              {pendingVerifications > 9 ? '9+' : pendingVerifications}
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 items-center gap-1.5 pl-1',
          (showAppBadge || showVerifyBadge || showUnseenBadge) && 'pr-10',
        )}
      >
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

      {columnId !== 'en_progreso' && (
        <div className="mt-2 space-y-1.5 pl-[22px]">
          <p className="truncate text-[12px] text-ink-muted/60">
            <span>📍 {caseItem.zone}</span>
            <span className="mx-1.5 text-ink-faint/50">·</span>
            <span>👤 {reporter}</span>
          </p>
          <p className="text-[12px] text-ink-muted/60">🕐 {timeAgo(caseItem.createdAt)}</p>
        </div>
      )}

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

      {timeline && (
        <div className="mt-2.5 space-y-1 border-t border-white/[0.06] pt-2 pl-[22px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
            Timeline
          </p>
          <ol className="space-y-1">
            {timeline.steps.map((step) => (
              <li
                key={step.id}
                className={cn(
                  'flex items-start gap-1.5 text-[11px] leading-snug',
                  step.state === 'current' && 'font-semibold text-ink',
                  step.state === 'done' && 'text-ink-muted/80',
                  step.state === 'pending' && 'text-ink-faint/70',
                )}
              >
                <span className="w-4 shrink-0 text-center" aria-hidden>
                  {step.icon}
                </span>
                <span className="min-w-0">
                  {step.label}
                  {step.state === 'current' && step.id !== 'completed' ? ' ←' : ''}
                  {step.detail && (
                    <span className="mt-0.5 block text-[10px] font-normal text-warning">
                      {step.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {timeline.delayLabel && (
            <p className="text-[11px] font-medium text-warning">{timeline.delayLabel}</p>
          )}
        </div>
      )}

      {columnId === 'en_progreso' && !timeline && (
        <p className="mt-2 pl-[22px] text-[11px] text-ink-faint">Misión pendiente de arranque</p>
      )}

      {resolved && (
        <p className="mt-2 pl-[22px] text-[11px] font-medium text-info">✅ Resuelto</p>
      )}
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          disabled={isDeleting}
          className={cn(
            'absolute bottom-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg',
            'border border-white/[0.08] bg-white/[0.06] text-ink-muted transition-colors',
            'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            'hover:border-critical/40 hover:bg-critical/15 hover:text-critical',
            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical/40',
          )}
          title="Eliminar caso"
          aria-label="Eliminar caso"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  )
}
