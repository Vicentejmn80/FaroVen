import { useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, PackagePlus, Truck, TruckIcon } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { TimelineItem } from '@/components/faro/timeline-item'
import { useFaro } from '@/store/faro-context'
import type { Site } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

interface CoordinatorHubScreenProps {
  onOpenDetail?: (site: Site) => void
  onRegisterNeed?: (siteId?: string) => void
  onUpdateSaturation?: (siteId?: string) => void
  onRegisterArrival?: (siteId?: string) => void
  onRegisterDispatch?: (siteId?: string) => void
}

export function CoordinatorHubScreen({
  onOpenDetail,
  onRegisterNeed,
  onUpdateSaturation,
  onRegisterArrival,
  onRegisterDispatch,
}: CoordinatorHubScreenProps) {
  const { sites, latestActivity, state } = useFaro()
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const site = useMemo(() => sites.find((item) => item.id === siteId) ?? null, [sites, siteId])
  const linkedReports = useMemo(
    () => state.reports.filter((report) => report.centerId === siteId).slice(0, 6),
    [siteId, state.reports],
  )

  if (!sites.length) {
    return (
      <ScreenScaffold title="Panel coordinador" subtitle="Operaciones">
        <GlassCard className="space-y-3">
          <p className="text-sm text-ink-muted">
            Aún no hay centros activos. Crea el primer centro desde el botón de acciones.
          </p>
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={() => onRegisterNeed?.()}>
            Abrir acciones
          </EmergencyButton>
        </GlassCard>
      </ScreenScaffold>
    )
  }

  return (
    <ScreenScaffold title="Panel coordinador" subtitle="Información verificada y logística">
      <div className="space-y-4 pt-2">
        <GlassCard className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Centro asignado</p>
          <select
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/60"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {sites.map((item) => (
              <option key={item.id} value={item.id} className="bg-base-900">
                {item.name}
              </option>
            ))}
          </select>
          {site && (
            <div className="rounded-2xl bg-white/[0.04] p-3 text-sm text-ink-muted">
              <p className="text-ink">{site.statusLabel}</p>
              <p>Última actualización {timeAgo(site.updatedAt)}</p>
            </div>
          )}
        </GlassCard>

        <div className="grid grid-cols-2 gap-2.5">
          <ActionCard
            icon={PackagePlus}
            label="Agregar necesidad"
            hint="Nuevo faltante"
            onClick={() => onRegisterNeed?.(site?.id)}
          />
          <ActionCard
            icon={BarChart3}
            label="Actualizar saturación"
            hint="Capacidad actual"
            onClick={() => onUpdateSaturation?.(site?.id)}
          />
          <ActionCard
            icon={Truck}
            label="Registrar llegada"
            hint="Donaciones entrantes"
            onClick={() => onRegisterArrival?.(site?.id)}
          />
          <ActionCard
            icon={TruckIcon}
            label="Registrar salida"
            hint="Recursos distribuidos"
            onClick={() => onRegisterDispatch?.(site?.id)}
          />
        </div>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Necesidades activas</p>
            {site && (
              <EmergencyButton variant="ghost" size="sm" onClick={() => onOpenDetail?.(site)}>
                Ver ficha
              </EmergencyButton>
            )}
          </div>
          {site?.needs.length ? (
            <div className="space-y-2">
              {site.needs.slice(0, 5).map((need) => (
                <div key={need.id} className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <NeedItemLabel name={need.item} className="text-sm text-ink" />
                    <span
                      className={cn(
                        'text-xs',
                        need.coverage < 40
                          ? 'text-critical'
                          : need.coverage < 75
                            ? 'text-warning'
                            : 'text-operational',
                      )}
                    >
                      {need.coverage}% cubierto
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">Sin necesidades registradas para este centro.</p>
          )}
        </GlassCard>

        <GlassCard className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Bandeja de reportes ciudadanos</p>
          {linkedReports.length ? (
            linkedReports.map((report) => (
              <div key={report.id} className="rounded-xl bg-white/[0.04] px-3 py-2">
                <p className="text-sm text-ink">{report.description}</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {report.source} · {timeAgo(report.createdAt)}
                </p>
                <div className="mt-2 flex gap-2">
                  <span className="inline-flex items-center rounded-full bg-operational-soft px-2 py-0.5 text-[11px] text-operational">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Revisar
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-subtle">No hay reportes pendientes para este centro.</p>
          )}
        </GlassCard>

        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Actividad en tiempo real</p>
          <GlassCard inset={false} className="p-3">
            {latestActivity.slice(0, 5).map((evt, i) => (
              <TimelineItem key={evt.id} event={evt} index={i} last={i === Math.min(4, latestActivity.length - 1)} />
            ))}
          </GlassCard>
        </section>
      </div>
    </ScreenScaffold>
  )
}

function ActionCard({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof PackagePlus
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass rounded-3xl p-3 text-left transition-colors hover:bg-white/[0.09]"
    >
      <Icon className="h-4.5 w-4.5 text-info" />
      <p className="mt-2 text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-ink-subtle">{hint}</p>
    </button>
  )
}
