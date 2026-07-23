import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, MapPin, Search } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { CaseStatusBadge } from './case-status-badge'

interface CaseQueueProps {
  cases: CaseDomain[]
  selectedId: string | null
  onSelect: (c: CaseDomain) => void
  className?: string
}

const PIPELINE_LABEL: Record<PipelineStage, string> = {
  [PIPELINE_STAGES.NUEVO]: 'Nuevo',
  [PIPELINE_STAGES.PENDING_REVIEW]: 'Pendiente',
  [PIPELINE_STAGES.VALIDATING]: 'Validando',
  [PIPELINE_STAGES.AWAITING_INFO]: 'Espera',
  [PIPELINE_STAGES.OPEN_FOR_APPLICATIONS]: 'Postulaciones',
  [PIPELINE_STAGES.ASSIGNED]: 'Asignado',
  [PIPELINE_STAGES.ACCEPTED]: 'Aceptado',
  [PIPELINE_STAGES.IN_ATTENTION]: 'Atención',
  [PIPELINE_STAGES.RESOLVED]: 'Resuelto',
  [PIPELINE_STAGES.ARCHIVED]: 'Archivado',
}

export function CaseQueue({ cases, selectedId, onSelect, className }: CaseQueueProps) {
  const [query, setQuery] = useState('')
  const [filterStage, setFilterStage] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let items = cases
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.zone.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q),
      )
    }
    if (filterStage) {
      items = items.filter((c) => c.pipelineStage === filterStage)
    }
    return items
  }, [cases, query, filterStage])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    cases.forEach((c) => {
      counts[c.pipelineStage] = (counts[c.pipelineStage] || 0) + 1
    })
    return counts
  }, [cases])

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="space-y-2 px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar casos..."
            className="h-8 w-full rounded-lg border border-white/[0.06] bg-white/[0.04] pl-8 pr-2 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-info/40"
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          <StageChip label="Todos" active={filterStage === null} onClick={() => setFilterStage(null)} />
          {Object.entries(stageCounts).map(([stage, count]) => (
            <StageChip
              key={stage}
              label={`${PIPELINE_LABEL[stage as PipelineStage] ?? stage} (${count})`}
              active={filterStage === stage}
              onClick={() => setFilterStage(filterStage === stage ? null : stage)}
            />
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 px-1.5 pb-2">
        <div className="space-y-0.5">
          {filtered.map((c, i) => (
            <CaseQueueItem
              key={c.id}
              caseItem={c}
              selected={c.id === selectedId}
              onSelect={() => onSelect(c)}
              index={i}
            />
          ))}
          {filtered.length === 0 && (
            <p className="px-3 pt-4 text-center text-xs text-ink-muted">
              No se encontraron casos
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

const PRIORITY_META: Record<string, { border: string; icon: typeof AlertTriangle }> = {
  critical: { border: 'border-l-critical', icon: AlertTriangle },
  high: { border: 'border-l-critical', icon: AlertTriangle },
  medium: { border: 'border-l-warning', icon: AlertTriangle },
  low: { border: 'border-l-white/[0.12]', icon: AlertTriangle },
}

function CaseQueueItem({
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
  const meta = PRIORITY_META[caseItem.priority] ?? PRIORITY_META.low
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={cn(
        'w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition-all',
        selected
          ? 'border-info/30 bg-info/[0.06]'
          : 'hover:bg-white/[0.04]',
        'border-l-[3px]',
        meta.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium leading-tight text-ink line-clamp-1">
          {caseItem.title}
        </p>
        <CaseStatusBadge stage={caseItem.pipelineStage} className="shrink-0" />
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1 min-w-0">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{caseItem.location.address ?? caseItem.location.zone ?? caseItem.zone}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" />
          {formatTimeAgo(caseItem.createdAt)}
        </span>
      </div>
    </motion.button>
  )
}

function StageChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors',
        active
          ? 'border-info/30 bg-info/10 text-info'
          : 'border-white/[0.06] text-ink-muted hover:text-ink-subtle',
      )}
    >
      {label}
    </button>
  )
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
