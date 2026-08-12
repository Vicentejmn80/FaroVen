import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { listReservationsByCase } from '@/services/logistics-service'
import { missionService } from '@/services/mission-service'
import { supabase } from '@/lib/supabase'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import {
  centerMissionStageLabel,
  getCenterMissionStage,
} from '@/domain/center-operations.types'
import { getResourceLabel } from '@/lib/resource-catalog'
import { CoverageProgressBar, parseCaseOpsSummary } from '@/components/operations-hub/case-ops-display'

async function resolveCenterName(centerId: string): Promise<string> {
  for (const table of ['hospitals', 'shelters', 'supply_centers'] as const) {
    const { data } = await supabase.from(table).select('name').eq('id', centerId).maybeSingle()
    const name = (data as { name?: string } | null)?.name
    if (name?.trim()) return name.trim()
  }
  return 'Centro asignado'
}

/**
 * Cobertura en vivo dentro de la ficha operativa — barra + estado del centro.
 */
export function CoverageLivePanel({ caseData }: { caseData: CaseDomain }) {
  const { data: reservations = [] } = useQuery({
    queryKey: [FARO_QUERY_KEYS.inventoryReservations, 'case', caseData.id],
    queryFn: () => listReservationsByCase(caseData.id),
    staleTime: 6_000,
  })
  const { data: missionBundle } = useQuery({
    queryKey: [FARO_QUERY_KEYS.missions, 'case-live', caseData.id],
    queryFn: async () => {
      const missions = await missionService.listByCaseId(caseData.id)
      const mission = missions[0]
      if (!mission) return { activeVolunteers: 0 }
      const assignments = await missionService.getAssignments(mission.id)
      const activeVolunteers = assignments.filter((a) =>
        ['assigned', 'accepted', 'preparing', 'en_route', 'on_site', 'in_progress'].includes(
          a.status,
        ),
      ).length
      return { activeVolunteers }
    },
    staleTime: 6_000,
  })

  const activeCenterReservation = useMemo(() => {
    return (
      reservations.find(
        (r) =>
          (r.status === 'ready' || r.status === 'reserved') &&
          r.resolutionMode !== 'declined',
      ) ??
      reservations.find((r) => r.status === 'delivered') ??
      null
    )
  }, [reservations])

  const declinedReservation = useMemo(
    () => reservations.find((r) => r.resolutionMode === 'declined' || r.status === 'cancelled'),
    [reservations],
  )

  const centerId = activeCenterReservation?.centerId ?? declinedReservation?.centerId ?? caseData.assignedCenterId

  const { data: centerName } = useQuery({
    queryKey: [FARO_QUERY_KEYS.coverage, 'center-name', centerId],
    queryFn: () => resolveCenterName(centerId!),
    enabled: Boolean(centerId),
    staleTime: 60_000,
  })

  const stats = useMemo(() => {
    const ops = parseCaseOpsSummary(caseData)
    const qtyFromDesc = ops.quantity?.match(/^(\d+)/)?.[1]
    const neededFromDesc = qtyFromDesc ? Number(qtyFromDesc) : null

    const reserved = reservations
      .filter((r) => r.status === 'reserved' || r.status === 'ready')
      .reduce((s, r) => s + r.quantity, 0)
    const delivered = reservations
      .filter((r) => r.status === 'delivered')
      .reduce((s, r) => s + r.quantity, 0)
    const covered = reserved + delivered
    const needed = Math.max(
      neededFromDesc ?? 0,
      caseData.affectedCount || 0,
      covered,
      1,
    )
    const activeVolunteers = missionBundle?.activeVolunteers ?? 0

    return { needed, covered, activeVolunteers }
  }, [reservations, missionBundle, caseData])

  const centerStatusLine = useMemo(() => {
    const name = centerName ?? 'Centro'
    if (activeCenterReservation) {
      if (activeCenterReservation.status === 'reserved' && !activeCenterReservation.resolutionMode) {
        return `Esperando respuesta de ${name}`
      }
      if (activeCenterReservation.resolutionMode === 'needs_volunteer') {
        return `${name} confirmó inventario — necesita voluntario`
      }
      const stage = getCenterMissionStage(activeCenterReservation)
      return `Cubierto por ${name} — Estado: ${centerMissionStageLabel(stage)}`
    }
    if (declinedReservation) {
      return `${name} no puede cubrir ${getResourceLabel(declinedReservation.resourceType)}`
    }
    if (caseData.assignedCenterId) {
      return caseData.pipelineStage === 'awaiting_center_confirmation'
        ? `Centro propuesto — esperando confirmación`
        : `Centro asignado: ${name}`
    }
    return null
  }, [
    activeCenterReservation,
    declinedReservation,
    centerName,
    caseData.assignedCenterId,
    caseData.pipelineStage,
  ])

  // Sin datos reales → quitar el contenedor completo (no "0/x" con barra vacía).
  if (!centerStatusLine && stats.covered === 0 && stats.activeVolunteers === 0) return null

  return (
    <GlassCard className="!rounded-xl !border-white/[0.08] !bg-white/[0.02] !p-3 !shadow-none space-y-2">
      {centerStatusLine && (
        <p
          className={`text-[13px] font-medium ${
            declinedReservation && !activeCenterReservation
              ? 'text-warning'
              : 'text-operational'
          }`}
        >
          {centerStatusLine}
        </p>
      )}
      <CoverageProgressBar current={stats.covered} total={stats.needed} />
      {stats.activeVolunteers > 0 && (
        <p className="text-[12px] text-ink-muted/60">
          {stats.activeVolunteers}{' '}
          {stats.activeVolunteers === 1 ? 'voluntario activo' : 'voluntarios activos'}
        </p>
      )}
    </GlassCard>
  )
}
