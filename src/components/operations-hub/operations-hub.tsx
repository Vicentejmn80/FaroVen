import { useCallback, useMemo, useState } from 'react'
import { LayoutGrid, Map as MapIcon } from 'lucide-react'
import { useCases, useCaseTimeline } from '@/hooks/useCases'
import { useTransitionCase, useAssignCase } from '@/hooks/useCaseMutations'
import { useFaro } from '@/store/faro-context'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { computeCaseSummary, sortCasesByUrgency, suggestCentersForCase } from '@/services/operations-hub-service'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import { CommandKpiBar } from './command-kpi-bar'
import { CaseKanbanBoard } from './case-kanban-board'
import { CaseDetailDrawer } from './case-detail-drawer'
import { OpsMapPanel } from './ops-map-panel'
import { cn } from '@/lib/utils'

type WorkspaceMode = 'pipeline' | 'map'

export function OperationsHub() {
  const { state } = useFaro()
  const { data: opsCases = [] } = useCases()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceMode>('pipeline')
  const transitionMutation = useTransitionCase()
  const assignMutation = useAssignCase()

  useRealtimeSync({
    channelName: 'ops-hub-cases',
    tables: ['cases', 'case_events'],
    invalidateKeys: [FARO_QUERY_KEYS.cases, FARO_QUERY_KEYS.caseEvents],
  })

  const { data: timeline = [] } = useCaseTimeline(selectedId)

  const sortedCases = useMemo(() => sortCasesByUrgency(opsCases), [opsCases])

  const selectedCase = useMemo(
    () => opsCases.find((c) => c.id === selectedId) ?? null,
    [opsCases, selectedId],
  )

  const summaryItems = useMemo(
    () => computeCaseSummary(opsCases, state.centers),
    [opsCases, state.centers],
  )

  const suggestions = useMemo(
    () => (selectedCase ? suggestCentersForCase(selectedCase, state.centers, state.needs) : []),
    [selectedCase, state.centers, state.needs],
  )

  const mapSites = useMemo(
    () =>
      state.centers.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        statusLabel: c.status,
        zone: c.location.zone,
        lat: c.location.coordinates.lat,
        lng: c.location.coordinates.lng,
        mapX: 0,
        mapY: 0,
        needs: [],
        updatedAt: c.updatedAt,
        verified: true,
      })),
    [state.centers],
  )

  const handleSelect = useCallback((c: CaseDomain) => {
    setSelectedId(c.id)
    setDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const handleTransition = useCallback(
    (caseId: string, toStage: PipelineStage, comment?: string) => {
      transitionMutation.mutate({ caseId, toStage, comment })
    },
    [transitionMutation],
  )

  const handleAssign = useCallback(
    (centerId: string) => {
      if (!selectedCase) return
      assignMutation.mutate({
        caseId: selectedCase.id,
        centerId,
        assignedBy: 'case-manager',
      })
    },
    [selectedCase, assignMutation],
  )

  const activeCount = useMemo(
    () =>
      opsCases.filter(
        (c) => c.pipelineStage !== 'resolved' && c.pipelineStage !== 'archived',
      ).length,
    [opsCases],
  )

  return (
    <div className="relative flex h-full flex-col bg-[radial-gradient(ellipse_at_top,_rgba(56,132,255,0.06),_transparent_55%)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              FARO · Operaciones
            </p>
            <h1 className="text-[15px] font-semibold text-ink">Centro de Comando</h1>
          </div>
          <span className="hidden rounded-full border border-info/25 bg-info/10 px-2.5 py-0.5 text-[10px] font-medium text-info sm:inline-flex">
            {activeCount} activos · {opsCases.length} total
          </span>
        </div>

        {/* Toggle Pipeline ↔ Mapa (disparador de vista interactiva) */}
        <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          <WorkspaceToggle
            active={workspace === 'pipeline'}
            onClick={() => setWorkspace('pipeline')}
            icon={LayoutGrid}
            label="Pipeline"
          />
          <WorkspaceToggle
            active={workspace === 'map'}
            onClick={() => setWorkspace('map')}
            icon={MapIcon}
            label="Mapa"
          />
        </div>
      </div>

      <div className="border-b border-white/[0.06] px-3 py-2.5 lg:px-4">
        <CommandKpiBar items={summaryItems} />
      </div>

      <div className="relative min-h-0 flex-1">
        {workspace === 'pipeline' ? (
          <div className="flex h-full min-h-0">
            <div className="min-w-0 flex-1">
              <CaseKanbanBoard
                cases={sortedCases}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>
            <div className="hidden w-72 shrink-0 border-l border-white/[0.06] xl:block xl:w-80">
              <OpsMapPanel
                selectedCase={selectedCase}
                cases={sortedCases}
                sites={mapSites}
                onSelectCase={handleSelect}
              />
            </div>
          </div>
        ) : (
          <OpsMapPanel
            selectedCase={selectedCase}
            cases={sortedCases}
            sites={mapSites}
            onSelectCase={handleSelect}
            className="h-full"
          />
        )}

        <CaseDetailDrawer
          open={drawerOpen}
          caseItem={selectedCase}
          timeline={timeline}
          suggestions={suggestions}
          onClose={handleCloseDrawer}
          onTransition={handleTransition}
          onAssign={handleAssign}
          isTransitioning={transitionMutation.isPending}
        />
      </div>
    </div>
  )
}

function WorkspaceToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof LayoutGrid
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
        active ? 'bg-white/[0.1] text-ink' : 'text-ink-muted hover:text-ink-subtle',
      )}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
