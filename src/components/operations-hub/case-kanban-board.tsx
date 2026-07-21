import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, MapPin, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { ScrollArea } from '@/components/ui/scroll-area'

/** Columnas del pipeline operativo (agrupa etapas del dominio). */
export const KANBAN_COLUMNS = [
  {
    id: 'nuevo',
    label: 'Nuevo',
    stages: [PIPELINE_STAGES.NUEVO] as PipelineStage[],
    accent: 'border-t-info',
    header: 'text-info',
  },
  {
    id: 'en_revision',
    label: 'En Revisión',
    stages: [PIPELINE_STAGES.PENDING_REVIEW, PIPELINE_STAGES.VALIDATING] as PipelineStage[],
    accent: 'border-t-warning',
    header: 'text-warning',
  },
  {
    id: 'asignado',
    label: 'Asignado',
    stages: [PIPELINE_STAGES.ASSIGNED, PIPELINE_STAGES.ACCEPTED] as PipelineStage[],
    accent: 'border-t-info',
    header: 'text-info',
  },
  {
    id: 'en_progreso',
    label: 'En Progreso',
    stages: [PIPELINE_STAGES.IN_ATTENTION] as PipelineStage[],
    accent: 'border-t-operational',
    header: 'text-operational',
  },
  {
    id: 'esperando',
    label: 'Esperando',
    stages: [PIPELINE_STAGES.AWAITING_INFO] as PipelineStage[],
    accent: 'border-t-warning',
    header: 'text-warning',
  },
  {
    id: 'resuelto',
    label: 'Resuelto',
    stages: [PIPELINE_STAGES.RESOLVED] as PipelineStage[],
    accent: 'border-t-operational',
    header: 'text-operational',
  },
] as const

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number]['id']

interface CaseKanbanBoardProps {
  cases: CaseDomain[]
  selectedId: string | null
  onSelect: (c: CaseDomain) => void
  className?: string
}

const PRIORITY_STYLE: Record<string, { bar: string; chip: string; label: string }> = {
  critical: {
    bar: 'bg-critical shadow-[0_0_8px_rgba(239,68,68,0.45)]',
    chip: 'bg-critical/15 text-critical border-critical/30',
    label: 'Crítico',
  },
  high: {
    bar: 'bg-critical',
    chip: 'bg-critical/10 text-critical border-critical/20',
    label: 'Alta',
  },
  medium: {
    bar: 'bg-warning',
    chip: 'bg-warning/10 text-warning border-warning/20',
    label: 'Media',
  },
  low: {
    bar: 'bg-white/20',
    chip: 'bg-white/[0.06] text-ink-muted border-white/10',
    label: 'Baja',
  },
}

export function CaseKanbanBoard({ cases, selectedId, onSelect, className }: CaseKanbanBoardProps) {
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

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="shrink-0 px-3 pb-2 pt-2 lg:px-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el pipeline…"
            className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-2 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-info/40"
          />
        </div>
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
                <header className="flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-2.5">
                  <h3 className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', col.header)}>
                    {col.label}
                  </h3>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-muted">
                    {items.length}
                  </span>
                </header>

                <ScrollArea className="min-h-0 flex-1 px-2 py-2">
                  <div className="space-y-2 pb-2">
                    {items.map((c, i) => (
                      <KanbanCard
                        key={c.id}
                        caseItem={c}
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
  selected,
  onSelect,
  index,
}: {
  caseItem: CaseDomain
  selected: boolean
  onSelect: () => void
  index: number
}) {
  const priority = PRIORITY_STYLE[caseItem.priority] ?? PRIORITY_STYLE.low
  const unassigned = !caseItem.assignedCenterId && !caseItem.assignedTo

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

      <div className="flex items-start justify-between gap-2 pl-1">
        <p className="min-w-0 text-[13px] font-semibold leading-snug text-ink line-clamp-2">
          {caseItem.title}
        </p>
        <span
          className={cn(
            'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
            priority.chip,
          )}
        >
          {priority.label}
        </span>
      </div>

      <div className="mt-2 space-y-1 pl-1 text-[11px] text-ink-muted">
        <p className="flex items-center gap-1.5 min-w-0">
          <MapPin className="h-3 w-3 shrink-0 opacity-70" />
          <span className="truncate">
            {(caseItem.location.address ?? caseItem.location.zone ?? caseItem.zone) || 'Sin zona'}
          </span>
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 min-w-0">
            <User className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{caseItem.reporterInfo.name ?? 'Ciudadano'}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(caseItem.createdAt)}
          </span>
        </div>
      </div>

      {unassigned && (
        <p className="mt-2 flex items-center gap-1 pl-1 text-[10px] font-medium text-warning">
          <AlertTriangle className="h-3 w-3" />
          Sin asignar
        </p>
      )}
    </motion.button>
  )
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
