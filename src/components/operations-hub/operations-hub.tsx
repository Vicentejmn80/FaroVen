import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutGrid, Map as MapIcon } from 'lucide-react'
import { useCases, useCaseTimeline } from '@/hooks/useCases'
import { useOperationalPublicNeeds, useNeedInterests } from '@/hooks/usePublicNeeds'
import { useTransitionCase, useAssignCase, useStartCaseReview } from '@/hooks/useCaseMutations'
import { useCaseApplications } from '@/hooks/useCaseApplications'
import { useMissionByCase, useMissionTimeline, useMissionAssignments } from '@/hooks/useMissions'
import { useVerifyAssignment } from '@/hooks/useMissionMutations'
import { useFaro } from '@/store/faro-context'
import { useAuth } from '@/store/auth-context'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { computeCaseSummary, sortCasesByUrgency, suggestCentersForCase } from '@/services/operations-hub-service'
import { isActiveStage } from '@/domain/case-lifecycle.service'
import { isProgressStage } from '@/domain/ops-pipeline'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import { CommandKpiBar } from './command-kpi-bar'
import { CaseKanbanBoard } from './case-kanban-board'
import { CaseDetailDrawer } from './case-detail-drawer'
import { OpsMapPanel } from './ops-map-panel'
import { cn } from '@/lib/utils'
import { MISSION_EVENT_LABELS, label } from '@/lib/labels'

type WorkspaceMode = 'pipeline' | 'map'

export function OperationsHub() {
  const { state } = useFaro()
  const { user } = useAuth()
  const { data: opsCases = [] } = useCases()
  const { data: operationalNeeds = [] } = useOperationalPublicNeeds()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceMode>('pipeline')
  const transitionMutation = useTransitionCase()
  const assignMutation = useAssignCase()
  const startReviewMutation = useStartCaseReview()
  const verifyMutation = useVerifyAssignment()

  useRealtimeSync({
    channelName: 'ops-hub-cases',
    tables: [
      'cases',
      'case_events',
      'case_applications',
      'mission_events',
      'mission_assignments',
      'missions',
      'public_needs',
      'coverage_reservations',
    ],
    invalidateKeys: [
      FARO_QUERY_KEYS.cases,
      FARO_QUERY_KEYS.caseEvents,
      FARO_QUERY_KEYS.caseApplications,
      FARO_QUERY_KEYS.missionEvents,
      FARO_QUERY_KEYS.missionAssignments,
      FARO_QUERY_KEYS.missions,
      FARO_QUERY_KEYS.publicNeeds,
      FARO_QUERY_KEYS.coverage,
    ],
  })

  const { data: timeline = [] } = useCaseTimeline(selectedId)
  const { data: mission } = useMissionByCase(selectedId)
  const missionId = mission?.id
  const { data: missionTimeline = [] } = useMissionTimeline(missionId ?? '')
  const { data: missionAssignments = [] } = useMissionAssignments(missionId ?? '')
  const { data: applications = [] } = useCaseApplications(selectedId ?? undefined)

  const selectedNeedId = useMemo(() => {
    if (!selectedId) return null
    return operationalNeeds.find((n) => n.caseId === selectedId)?.id ?? null
  }, [operationalNeeds, selectedId])

  const { data: interests = [] } = useNeedInterests(selectedNeedId)

  const sortedCases = useMemo(() => sortCasesByUrgency(opsCases), [opsCases])
  const mapCases = useMemo(
    () => sortedCases.filter((c) => isActiveStage(c.pipelineStage)),
    [sortedCases],
  )

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

  /** Hints vivos para tarjetas En progreso — se alimentan del timeline del caso seleccionado
   * y se cachean por caseId mientras el GC navega. */
  const [liveMissionHints, setLiveMissionHints] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!selectedId || !missionTimeline.length) return
    const latest = [...missionTimeline].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0]
    if (!latest) return
    const text = latest.description || label(MISSION_EVENT_LABELS, latest.eventType)
    setLiveMissionHints((prev) =>
      prev[selectedId] === text ? prev : { ...prev, [selectedId]: text },
    )
  }, [selectedId, missionTimeline])

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

  const handleSelect = useCallback(
    (c: CaseDomain) => {
      setSelectedId(c.id)
      setDrawerOpen(true)
      if (c.pipelineStage === 'nuevo' && !startReviewMutation.isPending) {
        startReviewMutation.mutate({ caseId: c.id, actorId: user?.id })
      }
    },
    [startReviewMutation, user?.id],
  )

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const handleTransition = useCallback(
    (caseId: string, toStage: PipelineStage, comment?: string) => {
      if (toStage === 'resolved') return
      if (toStage === 'archived') {
        const c = opsCases.find((x) => x.id === caseId)
        if (c && c.pipelineStage !== 'resolved') return
      }
      transitionMutation.mutate({ caseId, toStage, comment, actorId: user?.id })
    },
    [transitionMutation, user?.id, opsCases],
  )

  const handleAssign = useCallback(
    (centerId: string) => {
      if (!selectedCase) return
      assignMutation.mutate({
        caseId: selectedCase.id,
        centerId,
        assignedBy: user?.id ?? 'case-manager',
      })
    },
    [selectedCase, assignMutation, user?.id],
  )

  const handleStartReview = useCallback(
    (caseId: string) => {
      startReviewMutation.mutate({ caseId, actorId: user?.id })
    },
    [startReviewMutation, user?.id],
  )

  const handleVerify = useCallback(
    (assignmentId: string) => {
      if (!user?.id) return
      verifyMutation.mutate({ assignmentId, verifiedBy: user.id })
    },
    [verifyMutation, user?.id],
  )

  const activeCount = useMemo(
    () => opsCases.filter((c) => isActiveStage(c.pipelineStage)).length,
    [opsCases],
  )

  const progressCount = useMemo(
    () => opsCases.filter((c) => isProgressStage(c.pipelineStage)).length,
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
            {activeCount} activos · {progressCount} en progreso · {opsCases.length} total
          </span>
        </div>

        <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          <WorkspaceToggle
            active={workspace === 'pipeline'}
            onClick={() => setWorkspace('pipeline')}
            icon={LayoutGrid}
            label="Flujo"
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
                needs={operationalNeeds}
                selectedId={selectedId}
                onSelect={handleSelect}
                liveMissionHints={liveMissionHints}
              />
            </div>
            <div className="hidden w-72 shrink-0 border-l border-white/[0.06] xl:block xl:w-80">
              <OpsMapPanel
                selectedCase={selectedCase}
                cases={mapCases}
                sites={mapSites}
                onSelectCase={handleSelect}
              />
            </div>
          </div>
        ) : (
          <OpsMapPanel
            selectedCase={selectedCase}
            cases={mapCases}
            sites={mapSites}
            onSelectCase={handleSelect}
            className="h-full"
          />
        )}

        <CaseDetailDrawer
          open={drawerOpen}
          caseItem={selectedCase}
          timeline={timeline}
          missionTimeline={missionTimeline}
          missionAssignments={missionAssignments}
          coverage={{
            applications,
            interests,
            centers: suggestions,
          }}
          suggestions={suggestions}
          onClose={handleCloseDrawer}
          onTransition={handleTransition}
          onAssign={handleAssign}
          onStartReview={handleStartReview}
          onVerifyAssignment={handleVerify}
          isTransitioning={transitionMutation.isPending || startReviewMutation.isPending}
          isVerifying={verifyMutation.isPending}
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
        active ? 'bg-white/[0.1] text-ink' : 'text-ink-muted hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
