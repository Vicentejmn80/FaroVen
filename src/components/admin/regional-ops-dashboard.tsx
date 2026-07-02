import { useMemo } from 'react'
import {
  AlertTriangle,
  ClipboardList,
  Package,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { useFaro } from '@/store/faro-context'
import { usePendingCoordinatorRequests } from '@/hooks/useAuthRequests'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { timeAgo } from '@/lib/utils'

interface OpsMetric {
  id: string
  label: string
  value: number
  hint: string
  icon: typeof AlertTriangle
  tone: 'critical' | 'warning' | 'info' | 'operational'
}

const TONE_CLASS: Record<OpsMetric['tone'], string> = {
  critical: 'text-critical',
  warning: 'text-warning',
  info: 'text-info',
  operational: 'text-operational',
}

export function RegionalOpsDashboard() {
  const { sites, state } = useFaro()
  const { data: requests = [] } = usePendingCoordinatorRequests(true)
  const adminNotif = useAdminNotifications()

  const metrics = useMemo(() => {
    const operationalSites = sites.filter((s) => s.type !== 'organization')
    const criticalHospitals = operationalSites.filter(
      (s) => s.type === 'hospital' && s.status === 'critical',
    ).length
    const highOccupancyShelters = operationalSites.filter((s) => {
      if (s.type !== 'shelter') return false
      const center = state.centers.find((c) => c.id === s.id)
      if (!center?.capacity.total) return s.status === 'warning' || s.status === 'critical'
      return center.capacity.current / center.capacity.total >= 0.85
    }).length
    const lowInventoryCenters = operationalSites.filter((s) => {
      const needs = state.needs.filter((n) => n.centerId === s.id && n.available < n.required)
      const criticalNeeds = needs.filter((n) => n.priority === 'critical' || n.priority === 'high')
      return s.type === 'supply_center' && criticalNeeds.length >= 2
    }).length
    const pendingReports = state.reports.filter((r) => r.status === 'new').length
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const updatesToday = state.events.filter((e) => e.createdAt >= todayStart).length

    const items: OpsMetric[] = [
      {
        id: 'critical-hospitals',
        label: 'Hospitales críticos',
        value: criticalHospitals,
        hint: 'Requieren atención inmediata',
        icon: AlertTriangle,
        tone: criticalHospitals > 0 ? 'critical' : 'operational',
      },
      {
        id: 'shelter-occupancy',
        label: 'Refugios saturados',
        value: highOccupancyShelters,
        hint: 'Ocupación elevada',
        icon: Users,
        tone: highOccupancyShelters > 0 ? 'warning' : 'operational',
      },
      {
        id: 'supply-low',
        label: 'Acopios con bajo inventario',
        value: lowInventoryCenters,
        hint: 'Necesidades críticas activas',
        icon: Package,
        tone: lowInventoryCenters > 0 ? 'warning' : 'operational',
      },
      {
        id: 'coord-requests',
        label: 'Solicitudes de coordinador',
        value: requests.length,
        hint: 'Pendientes de revisión',
        icon: UserPlus,
        tone: requests.length > 0 ? 'info' : 'operational',
      },
      {
        id: 'citizen-reports',
        label: 'Reportes sin revisar',
        value: pendingReports,
        hint: 'Información ciudadana',
        icon: ClipboardList,
        tone: pendingReports > 0 ? 'warning' : 'operational',
      },
      {
        id: 'updates-today',
        label: 'Actualizaciones hoy',
        value: updatesToday,
        hint: 'Actividad operativa',
        icon: TrendingUp,
        tone: 'info',
      },
    ]
    return items
  }, [sites, state, requests.length])

  const unreadNotif = adminNotif.unreadCount

  return (
    <section className="space-y-3">
      <GlassCard className="space-y-1">
        <p className="text-[15px] font-semibold text-ink">Centro de operaciones</p>
        <p className="text-sm text-ink-subtle">¿Qué requiere tu atención ahora mismo?</p>
        {unreadNotif > 0 && (
          <p className="text-xs text-info">{unreadNotif} notificación{unreadNotif === 1 ? '' : 'es'} sin leer</p>
        )}
      </GlassCard>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <GlassCard
              key={metric.id}
              className="space-y-1.5 transition-colors hover:bg-white/[0.06]"
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${TONE_CLASS[metric.tone]}`} strokeWidth={1.75} />
                <span className={`text-2xl font-semibold tabular-nums ${TONE_CLASS[metric.tone]}`}>
                  {metric.value}
                </span>
              </div>
              <p className="text-xs font-medium text-ink">{metric.label}</p>
              <p className="text-[11px] text-ink-faint">{metric.hint}</p>
            </GlassCard>
          )
        })}
      </div>

      <p className="px-1 text-[11px] text-ink-faint">
        Actualizado {timeAgo(new Date())}
      </p>
    </section>
  )
}
