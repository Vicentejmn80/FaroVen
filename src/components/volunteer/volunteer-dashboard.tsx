import { useMemo } from 'react'
import {
  AlertTriangle,
  Clock3,
  Handshake,
  HeartHandshake,
  MapPin,
  Users,
  ClipboardList,
  Building2,
  type LucideIcon,
} from 'lucide-react'
import { ActionCard } from '@/components/ui/action-card'
import { GlassCard } from '@/components/ui/glass-card'
import { MetricCard } from '@/components/ui/metric-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import type { Need } from '@/domain/models'
import type { Site } from '@/lib/types'
import { PRIORITY_OPTIONS } from '@/lib/site-utils'
import { impactProgressPct, loadVolunteerImpact } from '@/lib/volunteer-impact'
import { cn, timeAgo } from '@/lib/utils'

export interface VolunteerDashboardProps {
  firstName: string
  userId?: string | null
  sites: Site[]
  needs: Need[]
  onViewAllNeeds: () => void
  onOfferHelp: () => void
  onMyCollaborations: () => void
  onOpenNeed?: (needId: string, siteId: string) => void
}

type Priority = Need['priority']

const PRIORITY_BADGE: Record<
  Priority,
  { label: string; className: string; iconBg: string; Icon: LucideIcon }
> = {
  critical: {
    label: 'Crítico',
    className: 'bg-critical/15 text-critical ring-critical/25',
    iconBg: 'bg-critical/15 text-critical',
    Icon: AlertTriangle,
  },
  high: {
    label: 'Alto',
    className: 'bg-warning/15 text-warning ring-warning/25',
    iconBg: 'bg-warning/15 text-warning',
    Icon: AlertTriangle,
  },
  medium: {
    label: 'Medio',
    className: 'bg-info/15 text-info ring-info/25',
    iconBg: 'bg-info/15 text-info',
    Icon: ClipboardList,
  },
  low: {
    label: 'Bajo',
    className: 'bg-operational/15 text-operational ring-operational/25',
    iconBg: 'bg-operational/15 text-operational',
    Icon: ClipboardList,
  },
}

function isActiveNeed(need: Need): boolean {
  if (need.status === 'resolved' || need.status === 'pending_closure') return false
  return need.available < need.required
}

function priorityRank(priority: Priority): number {
  if (priority === 'critical') return 0
  if (priority === 'high') return 1
  if (priority === 'medium') return 2
  return 3
}

function priorityLabel(priority: Priority): string {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? PRIORITY_BADGE[priority].label
}

/**
 * Dashboard operativo del voluntario — KPIs, necesidades cercanas, impacto y acciones.
 */
export function VolunteerDashboard({
  firstName,
  userId,
  sites,
  needs,
  onViewAllNeeds,
  onOfferHelp,
  onMyCollaborations,
  onOpenNeed,
}: VolunteerDashboardProps) {
  const impact = useMemo(() => loadVolunteerImpact(userId), [userId])
  const progress = impactProgressPct(impact)

  const { activeNeeds, peopleNeedingHelp, nearbyRows, collaborationsInProgress } = useMemo(() => {
    const active = needs.filter(isActiveNeed)
    const siteById = new Map(sites.map((s) => [s.id, s]))
    const people = active.reduce((sum, n) => sum + Math.max(0, n.required - n.available), 0)

    const rows = [...active]
      .sort((a, b) => {
        const rank = priorityRank(a.priority) - priorityRank(b.priority)
        if (rank !== 0) return rank
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      })
      .slice(0, 8)
      .map((need, index) => {
        const site = siteById.get(need.centerId)
        return {
          need,
          siteName: site?.name ?? 'Centro',
          zone: site?.zone ?? 'Zona sin definir',
          // Distancia estimada estable por índice hasta GPS de voluntario
          distanceKm: (1.1 + (index % 5) * 0.7 + (need.id.charCodeAt(0) % 7) * 0.15).toFixed(1),
        }
      })

    return {
      activeNeeds: active.length,
      peopleNeedingHelp: people,
      nearbyRows: rows,
      collaborationsInProgress: Math.min(active.length, impact.needsSupported > 0 ? 3 : 0) ||
        (active.length > 0 ? Math.min(3, Math.ceil(active.length / 8)) : 0),
    }
  }, [needs, sites, impact.needsSupported])

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-32 pt-3 lg:px-8 lg:pb-8">
      <header className="mb-5 space-y-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          Hola, {firstName}{' '}
          <span aria-hidden className="text-[22px]">
            💚
          </span>
        </h1>
        <p className="text-sm text-ink-muted">Gracias por querer ayudar.</p>
      </header>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <MetricCard
          icon={ClipboardList}
          label="Necesidades activas"
          value={activeNeeds}
          hint="cerca de ti"
          tone={activeNeeds > 0 ? 'warning' : 'operational'}
        />
        <MetricCard
          icon={Users}
          label="Personas que necesitan ayuda"
          value={peopleNeedingHelp}
          hint="en tu área"
          tone={peopleNeedingHelp > 0 ? 'critical' : 'operational'}
        />
        <MetricCard
          icon={Clock3}
          label="Horas colaboradas"
          value={impact.hoursCollaborated}
          hint="este mes"
          tone="info"
        />
        <MetricCard
          icon={Handshake}
          label="Colaboraciones"
          value={collaborationsInProgress}
          hint="en progreso"
          tone={collaborationsInProgress > 0 ? 'info' : 'neutral'}
        />
      </div>

      {/* Cuerpo 2 columnas */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)] lg:items-start">
        {/* Izquierda — lista necesidades */}
        <GlassCard className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-info">
              Necesidades activas cerca de ti
            </p>
          </div>

          {nearbyRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-subtle">
              No hay necesidades activas en este momento. Vuelve pronto.
            </p>
          ) : (
            <ScrollArea maxHeightClassName="max-h-[min(52vh,480px)]" className="pr-1">
              <ul className="space-y-2">
                {nearbyRows.map(({ need, siteName, zone, distanceKm }) => {
                  const badge = PRIORITY_BADGE[need.priority]
                  const Icon = badge.Icon
                  return (
                    <li key={need.id}>
                      <button
                        type="button"
                        onClick={() => onOpenNeed?.(need.id, need.centerId)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                            badge.iconBg,
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <NeedItemLabel name={need.type} className="text-sm font-semibold text-ink" />
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-subtle">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {siteName}
                            </span>
                            <span>·</span>
                            <span>{zone}</span>
                            <span>·</span>
                            <span className="capitalize">{timeAgo(need.updatedAt)}</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                              badge.className,
                            )}
                          >
                            {priorityLabel(need.priority)}
                          </span>
                          <span className="text-[11px] tabular-nums text-ink-faint">{distanceKm} km</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}

          <button
            type="button"
            onClick={onViewAllNeeds}
            className="text-sm font-medium text-info hover:underline"
          >
            Ver todas las necesidades
          </button>
        </GlassCard>

        {/* Derecha — impacto + acciones */}
        <div className="space-y-3">
          <GlassCard className="space-y-4 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Tu impacto
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Meta mensual de horas</span>
                <span className="tabular-nums text-ink-subtle">
                  {impact.hoursCollaborated}/{impact.monthlyHoursGoal} h
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-info transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ul className="space-y-2.5">
              <ImpactRow icon={Clock3} label="Horas colaboradas" value={`${impact.hoursCollaborated} h`} />
              <ImpactRow icon={Users} label="Personas ayudadas" value={String(impact.peopleHelped)} />
              <ImpactRow
                icon={HeartHandshake}
                label="Necesidades apoyadas"
                value={String(impact.needsSupported)}
              />
              <ImpactRow icon={Building2} label="Centros visitados" value={String(impact.centersVisited)} />
            </ul>
          </GlassCard>

          <GlassCard inset={false} className="space-y-1 p-2">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Acciones rápidas
            </p>
            <ActionCard
              variant="row"
              icon={ClipboardList}
              label="Ver todas las necesidades"
              hint="Mapa y listado completo"
              onClick={onViewAllNeeds}
            />
            <ActionCard
              variant="row"
              icon={HeartHandshake}
              label="Ofrecer ayuda"
              hint="Súmate a una necesidad activa"
              onClick={onOfferHelp}
            />
            <ActionCard
              variant="row"
              icon={Handshake}
              label="Mis colaboraciones"
              hint="Seguimiento de tu participación"
              onClick={onMyCollaborations}
            />
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

function ImpactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2.5 text-sm text-ink-muted">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-ink-subtle">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
    </li>
  )
}
