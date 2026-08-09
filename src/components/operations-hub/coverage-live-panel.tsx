import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { listReservationsByCase } from '@/services/logistics-service'
import { missionService } from '@/services/mission-service'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { CoverageProgressBar, parseCaseOpsSummary } from '@/components/operations-hub/case-ops-display'

/**
 * Cobertura en vivo dentro de la ficha operativa — barra de progreso clara.
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
        ['assigned', 'accepted', 'preparing', 'en_route', 'on_site', 'in_progress'].includes(a.status),
      ).length
      return { activeVolunteers }
    },
    staleTime: 6_000,
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

  return (
    <GlassCard className="!rounded-xl !border-white/[0.08] !bg-white/[0.02] !p-3 !shadow-none space-y-2">
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
