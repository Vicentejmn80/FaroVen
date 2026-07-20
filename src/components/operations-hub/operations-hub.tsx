import { useCallback, useMemo, useState } from 'react'
import { useCases, useCaseTimeline } from '@/hooks/useCases'
import { useTransitionCase, useAssignCase } from '@/hooks/useCaseMutations'
import { useFaro } from '@/store/faro-context'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { computeCaseSummary, sortCasesByUrgency, suggestCentersForCase } from '@/services/operations-hub-service'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import { OpsSummaryBar } from './ops-summary-bar'
import { CaseQueue } from './case-queue'
import { CaseDetailPanel } from './case-detail-panel'
import { OpsMapPanel } from './ops-map-panel'
import { OpsNotificationTray } from './ops-notification-tray'
import type { OpsNotification } from '@/types/operations-hub.types'

export function OperationsHub() {
  const { state } = useFaro()
  const { data: opsCases = [] } = useCases()
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  const handleSelect = useCallback((c: CaseDomain) => {
    setSelectedId(c.id)
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-ink">Centro de Operaciones</h1>
          <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
            {opsCases.length} casos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <OpsNotificationTray
            notifications={notifications}
            onMarkRead={(id) => setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)))}
            onMarkAllRead={() => setNotifications((p) => p.map((n) => ({ ...n, read: true })))}
            onOpenCase={(caseId) => setSelectedId(caseId)}
          />
        </div>
      </div>

      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <OpsSummaryBar items={summaryItems} />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 border-r border-white/[0.06]">
          <CaseQueue
            cases={sortedCases}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>

        <div className="min-w-0 flex-1 border-r border-white/[0.06]">
          <CaseDetailPanel
            caseItem={selectedCase}
            timeline={timeline}
            suggestions={suggestions}
            onTransition={handleTransition}
            onAssign={handleAssign}
            isTransitioning={transitionMutation.isPending}
          />
        </div>

        <div className="hidden w-80 shrink-0 lg:block xl:w-96">
          <OpsMapPanel selectedCase={selectedCase} sites={state.centers.map((c) => ({
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
          }))} />
        </div>
      </div>
    </div>
  )
}
