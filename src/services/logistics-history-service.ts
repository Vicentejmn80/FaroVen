import { supabase } from '@/lib/supabase'
import { getResourceLabel } from '@/lib/resource-catalog'
import { listReservationsByCenter } from '@/services/logistics-service'

export interface LogisticsHistoryEntry {
  id: string
  at: Date
  kind: 'reservation' | 'mission' | 'movement'
  title: string
  subtitle: string
  status: string
  statusLabel: string
  caseId?: string
  missionId?: string
}

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  reserved: 'Reservado',
  ready: 'Listo',
  delivered: 'Entregado',
  released: 'Liberado',
  cancelled: 'Cancelado',
}

export async function buildCenterLogisticsHistory(centerId: string): Promise<LogisticsHistoryEntry[]> {
  const reservations = await listReservationsByCenter(centerId)
  const reservationRows: LogisticsHistoryEntry[] = reservations.map((r) => ({
    id: `res-${r.id}`,
    at: r.updatedAt,
    kind: 'reservation',
    title: `${r.quantity} × ${getResourceLabel(r.resourceType)}`,
    subtitle: `Caso ${r.caseId.slice(0, 8)}`,
    status: r.status,
    statusLabel: RESERVATION_STATUS_LABELS[r.status] ?? r.status,
    caseId: r.caseId,
    missionId: r.missionId,
  }))

  const { data: missions } = await supabase
    .from('missions')
    .select('id, title, status, case_id, updated_at')
    .eq('pickup_center_id', centerId)
    .order('updated_at', { ascending: false })
    .limit(30)

  const missionRows: LogisticsHistoryEntry[] = ((missions ?? []) as Array<{
    id: string
    title: string
    status: string
    case_id: string | null
    updated_at: string
  }>).map((m) => ({
    id: `mis-${m.id}`,
    at: new Date(m.updated_at),
    kind: 'mission',
    title: m.title,
    subtitle: m.case_id ? `Caso ${m.case_id.slice(0, 8)}` : 'Misión logística',
    status: m.status,
    statusLabel: m.status,
    caseId: m.case_id ?? undefined,
    missionId: m.id,
  }))

  return [...reservationRows, ...missionRows]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 50)
}
