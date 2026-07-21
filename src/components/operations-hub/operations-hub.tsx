import { useCallback, useMemo, useState } from 'react'
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
import { OpsNotificationTray } from './ops-notification-tray'
import type { OpsNotification } from '@/types/operations-hub.types'

export function OperationsHub() {
  const { state } = useFaro()
  const { data: opsCases = [] } = useCases()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifications, setNotifications] = useState<OpsNotification[]>([])
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

        <OpsNotificationTray
          notifications={notifications}
          onMarkRead={(id) =>
            setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)))
          }
          onMarkAllRead={() => setNotifications((p) => p.map((n) => ({ ...n, read: true })))}
          onOpenCase={(caseId) => {
            setSelectedId(caseId)
            setDrawerOpen(true)
          }}
        />
      </div>

      <div className="border-b border-white/[0.06] px-3 py-2.5 lg:px-4">
        <CommandKpiBar items={summaryItems} />
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="flex h-full min-h-0">
          <div className="min-w-0 flex-1">
            <CaseKanbanBoard
              cases={sortedCases}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
          {/* Mapa contextual lateral — sin toggle redundante "Mapa" */}
          <div className="hidden w-72 shrink-0 border-l border-white/[0.06] xl:block xl:w-80">
            <OpsMapPanel selectedCase={selectedCase} sites={mapSites} />
          </div>
        </div>

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
