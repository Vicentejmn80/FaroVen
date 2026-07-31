import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { listReservationsByCase } from '@/services/logistics-service'
import { missionService } from '@/services/mission-service'
import { getResourceLabel } from '@/lib/resource-catalog'
import type { CaseDomain } from '@/domain/case-lifecycle.types'

/**
 * Panel GC en tiempo real: Necesario / Reservado / Entregado / Disponible + voluntarios activos.
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
    const needed = Math.max(1, caseData.affectedCount || 1)
    const reserved = reservations
      .filter((r) => r.status === 'reserved' || r.status === 'ready')
      .reduce((s, r) => s + r.quantity, 0)
    const delivered = reservations
      .filter((r) => r.status === 'delivered')
      .reduce((s, r) => s + r.quantity, 0)
    const available = Math.max(0, needed - reserved - delivered)
    const activeVolunteers = missionBundle?.activeVolunteers ?? 0
    const centerId =
      reservations.find((r) => r.status === 'ready' || r.status === 'reserved')?.centerId ??
      caseData.assignedCenterId
    return { needed, reserved, delivered, available, activeVolunteers, centerId }
  }, [reservations, missionBundle, caseData])

  const resourceHint = reservations[0]
    ? getResourceLabel(reservations[0].resourceType)
    : caseData.category

  return (
    <GlassCard className="!rounded-xl !border-info/20 !bg-info/[0.04] !p-3 !shadow-none space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-info">
        Cobertura en vivo
      </p>
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Metric label="Necesario" value={stats.needed} />
        <Metric label="Reservado" value={stats.reserved} />
        <Metric label="Entregado" value={stats.delivered} />
        <Metric label="Disponible" value={stats.available} />
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-ink-muted">
        <span>Voluntarios activos · {stats.activeVolunteers}</span>
        {stats.centerId && <span>Centro · {stats.centerId.slice(0, 10)}…</span>}
        <span>{resourceHint}</span>
      </div>
    </GlassCard>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}
