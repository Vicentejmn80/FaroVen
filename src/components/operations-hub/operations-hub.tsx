import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, Map as MapIcon } from 'lucide-react'
import { useCases, useCaseTimeline, useOpenCaseForApplications, useDeleteCase } from '@/hooks/useCases'
import {
  useOperationalPublicNeeds,
  useNeedInterests,
  useApproveNeedInterest,
  useRejectNeedInterest,
} from '@/hooks/usePublicNeeds'
import { useTransitionCase, useStartCaseReview } from '@/hooks/useCaseMutations'
import { assignCaseWithDispatchRules, canOpenRadarForCase, resolveCenterDispatchMode } from '@/services/faro-assignment-service'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { useRequestInventoryFromCenter } from '@/hooks/useLogistics'
import { resolveCatalogKey } from '@/lib/resource-catalog'
import { useToast } from '@/store/toast-context'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import {
  useCaseApplications,
  useApproveCaseApplication,
  useRejectCaseApplication,
  usePendingApplicationsQueue,
} from '@/hooks/useCaseApplications'
import {
  useMissionByCase,
  useMissionTimeline,
  useMissionAssignments,
  usePendingVerificationCounts,
} from '@/hooks/useMissions'
import { useBoardMissionLive } from '@/hooks/useBoardMissionLive'
import { PIPELINE_STAGES } from '@/domain/case-lifecycle.types'
import { useVerifyAssignment } from '@/hooks/useMissionMutations'
import { useFaro } from '@/store/faro-context'
import { useAuth } from '@/store/auth-context'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { computeCaseSummary, sortCasesByUrgency, suggestCentersForCase } from '@/services/operations-hub-service'
import { operationalRecommendationService } from '@/services/operational-recommendation-service'
import { isActiveStage } from '@/domain/case-lifecycle.service'
import { isCoverageStage, isProgressStage, isReviewStage } from '@/domain/ops-pipeline'
import { canPublishNeed } from '@/domain/case-publish-rules'
import type { CaseDomain, PipelineStage } from '@/domain/case-lifecycle.types'
import { markCaseEventsViewed } from '@/lib/case-events-viewed-storage'
import { cleanCaseTitle } from '@/components/operations-hub/case-ops-display'
import { CommandKpiBar } from './command-kpi-bar'
import { CaseKanbanBoard } from './case-kanban-board'
import { CaseDetailDrawer } from './case-detail-drawer'
import { OpsMapPanel } from './ops-map-panel'
import { cn } from '@/lib/utils'

type WorkspaceMode = 'pipeline' | 'map'

export function OperationsHub() {
  const { state } = useFaro()
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { data: opsCases = [] } = useCases()
  const { data: operationalNeeds = [] } = useOperationalPublicNeeds()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceMode>('pipeline')
  const [viewedTick, setViewedTick] = useState(0)
  const openCallMutation = useOpenCaseForApplications()
  const deleteCaseMutation = useDeleteCase()
  const transitionMutation = useTransitionCase()
  const assignMutation = useMutation({
    mutationFn: async ({
      caseData,
      centerId,
      actorId,
      inventoryTip,
    }: {
      caseData: CaseDomain
      centerId: string
      actorId: string
      inventoryTip?: { available: number; resourceType: string; quantity: number }
    }) => {
      try {
        return await assignCaseWithDispatchRules({ caseData, centerId, actorId, inventoryTip })
      } catch (err) {
        throw new Error(humanizeSupabaseError(err))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      showToast('Centro propuesto — esperando confirmación.', 'success')
    },
  })
  const requestInventory = useRequestInventoryFromCenter()
  const startReviewMutation = useStartCaseReview()
  const verifyMutation = useVerifyAssignment()
  const approveApp = useApproveCaseApplication()
  const rejectApp = useRejectCaseApplication()
  const approveInterest = useApproveNeedInterest()
  const rejectInterest = useRejectNeedInterest()

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
  const { data: pendingAppsQueue = [] } = usePendingApplicationsQueue(true)
  const { data: pendingVerifyRaw = {} } = usePendingVerificationCounts(true)

  const pendingApplicationsByCase = useMemo(() => {
    const map: Record<string, number> = {}
    for (const app of pendingAppsQueue) {
      map[app.caseId] = (map[app.caseId] ?? 0) + 1
    }
    return map
  }, [pendingAppsQueue])

  const pendingVerificationsByCase = useMemo(() => {
    const resolved = new Set(
      opsCases
        .filter(
          (c) =>
            c.pipelineStage === PIPELINE_STAGES.RESOLVED ||
            c.pipelineStage === PIPELINE_STAGES.ARCHIVED,
        )
        .map((c) => c.id),
    )
    const map: Record<string, number> = {}
    for (const [caseId, count] of Object.entries(pendingVerifyRaw)) {
      if (resolved.has(caseId) || count <= 0) continue
      map[caseId] = count
    }
    return map
  }, [pendingVerifyRaw, opsCases])

  const selectedNeedId = useMemo(() => {
    if (!selectedId) return null
    return operationalNeeds.find((n) => n.caseId === selectedId)?.id ?? null
  }, [operationalNeeds, selectedId])

  const selectedNeedPublished = useMemo(() => {
    if (!selectedId) return false
    return operationalNeeds.some(
      (n) =>
        n.caseId === selectedId &&
        n.callStatus === 'open' &&
        n.visibilityStatus === 'public',
    )
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

  const recoEnabled =
    !!selectedCase &&
    (isReviewStage(selectedCase.pipelineStage) || isCoverageStage(selectedCase.pipelineStage))

  const { data: reco } = useQuery({
    queryKey: [
      FARO_QUERY_KEYS.coverage,
      'ops-reco',
      selectedCase?.id,
      selectedCase?.pipelineStage,
    ],
    queryFn: () => operationalRecommendationService.recommend(selectedCase!),
    enabled: recoEnabled,
    staleTime: 20_000,
  })

  const inventoryTips = useMemo(
    () =>
      (reco?.inventory ?? []).map((c) => ({
        centerId: c.centerId,
        centerName: c.centerName,
        available: c.available,
        unit: c.unit,
        distanceKm: c.distanceKm,
      })),
    [reco?.inventory],
  )

  const progressCaseIds = useMemo(
    () => opsCases.filter((c) => isProgressStage(c.pipelineStage)).map((c) => c.id),
    [opsCases],
  )
  const { byCase: missionLiveByCase, unseenByCase: unseenMissionEventsByCase } =
    useBoardMissionLive(progressCaseIds, user?.id, viewedTick)

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
      if (user?.id) {
        markCaseEventsViewed(user.id, c.id)
        setViewedTick((t) => t + 1)
      }
      if (c.pipelineStage === 'nuevo' && !startReviewMutation.isPending) {
        startReviewMutation.mutate({ caseId: c.id, actorId: user?.id })
      }
    },
    [startReviewMutation, user?.id],
  )

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const handleDeleteCase = useCallback(
    (c: CaseDomain) => {
      const label = cleanCaseTitle(c.title).headline || c.title
      if (
        !window.confirm(
          `¿Eliminar el caso "${label}" por completo?\n\nSe borrarán misiones, postulaciones y necesidades asociadas. Esta acción no se puede deshacer.`,
        )
      ) {
        return
      }
      deleteCaseMutation.mutate(c.id, {
        onSuccess: () => {
          if (selectedId === c.id) {
            setSelectedId(null)
            setDrawerOpen(false)
          }
          showToast('Caso eliminado.', 'success')
        },
        onError: (err) => showToast(humanizeSupabaseError(err), 'warning'),
      })
    },
    [deleteCaseMutation, selectedId, showToast],
  )

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
      if (!selectedCase || !user?.id) return
      const tip = inventoryTips.find((t) => t.centerId === centerId)

      if (tip) {
        assignMutation.mutate({
          caseData: selectedCase,
          centerId,
          actorId: user.id,
          inventoryTip: {
            available: tip.available,
            resourceType: resolveCatalogKey(selectedCase.category) ?? 'agua',
            quantity: Math.max(
              1,
              Math.min(tip.available, reco?.minQty ?? selectedCase.affectedCount ?? 1),
            ),
          },
        })
        return
      }

      assignMutation.mutate({
        caseData: selectedCase,
        centerId,
        actorId: user.id,
      })
    },
    [selectedCase, assignMutation, user?.id, inventoryTips, reco?.minQty],
  )

  const handleUseInventory = useCallback(() => {
    const tip = inventoryTips[0]
    if (!selectedCase || !user?.id || !tip) return
    requestInventory.mutate({
      caseData: selectedCase,
      centerId: tip.centerId,
      resourceType: resolveCatalogKey(selectedCase.category) ?? 'agua',
      quantity: Math.max(
        1,
        Math.min(tip.available, reco?.minQty ?? selectedCase.affectedCount ?? 1),
      ),
      actorId: user.id,
    })
  }, [selectedCase, user?.id, inventoryTips, requestInventory, reco?.minQty])

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

  const { data: assignedDispatchMode } = useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'dispatch-mode', selectedCase?.assignedCenterId],
    queryFn: () => resolveCenterDispatchMode(selectedCase!.assignedCenterId!),
    enabled: Boolean(selectedCase?.assignedCenterId),
    staleTime: 30_000,
  })

  const radarGate = useMemo(
    () =>
      selectedCase
        ? canOpenRadarForCase(selectedCase, assignedDispatchMode ?? null)
        : { allowed: true as const },
    [selectedCase, assignedDispatchMode],
  )

  const mayPublishSelected = selectedCase ? canPublishNeed(selectedCase.pipelineStage) : false

  const handlePublishNeed = useCallback(() => {
    if (!selectedCase) return
    if (!radarGate.allowed) {
      showToast(radarGate.reason ?? 'No se puede abrir la convocatoria para este caso.', 'info')
      return
    }
    if (openCallMutation.isPending) return
    openCallMutation.mutate(
      { caseId: selectedCase.id, actorId: user?.id },
      {
        onSuccess: () => {
          showToast(
            'Convocatoria abierta. Los voluntarios pueden ver la necesidad en el mapa.',
            'success',
          )
        },
        onError: (err: Error) => {
          showToast(err.message || 'No se pudo abrir la convocatoria.', 'warning')
        },
      },
    )
  }, [selectedCase, radarGate, showToast, openCallMutation, user?.id])

  const handleViewOnMap = useCallback(() => {
    setWorkspace('map')
  }, [])

  const handleApproveApplication = useCallback(
    (applicationId: string, pickupCenterId?: string) => {
      if (!user?.id) return
      approveApp.mutate({ applicationId, operatorId: user.id, pickupCenterId })
    },
    [approveApp, user?.id],
  )

  const handleRejectApplication = useCallback(
    (applicationId: string) => {
      if (!user?.id) return
      rejectApp.mutate({ applicationId, operatorId: user.id })
    },
    [rejectApp, user?.id],
  )

  const handleApproveInterest = useCallback(
    (reservationId: string) => {
      if (!user?.id) return
      approveInterest.mutate({ reservationId, operatorId: user.id })
    },
    [approveInterest, user?.id],
  )

  const handleRejectInterest = useCallback(
    (reservationId: string) => {
      if (!user?.id) return
      rejectInterest.mutate({ reservationId, operatorId: user.id })
    },
    [rejectInterest, user?.id],
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
                pendingApplicationsByCase={pendingApplicationsByCase}
                pendingVerificationsByCase={pendingVerificationsByCase}
                missionLiveByCase={missionLiveByCase}
                unseenMissionEventsByCase={unseenMissionEventsByCase}
                onDelete={handleDeleteCase}
                deletingCaseId={deleteCaseMutation.isPending ? deleteCaseMutation.variables ?? null : null}
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
          inventoryTips={inventoryTips}
          onClose={handleCloseDrawer}
          onTransition={handleTransition}
          onAssign={handleAssign}
          onUseInventory={handleUseInventory}
          onStartReview={handleStartReview}
          onVerifyAssignment={handleVerify}
          onOpenRadar={mayPublishSelected ? handlePublishNeed : undefined}
          canOpenRadar={mayPublishSelected && radarGate.allowed && !openCallMutation.isPending}
          radarBlockedReason={radarGate.reason}
          needPublished={selectedNeedPublished}
          onViewOnMap={handleViewOnMap}
          onApproveApplication={handleApproveApplication}
          onRejectApplication={handleRejectApplication}
          onApproveInterest={handleApproveInterest}
          onRejectInterest={handleRejectInterest}
          isTransitioning={
            transitionMutation.isPending ||
            startReviewMutation.isPending ||
            openCallMutation.isPending
          }
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
