import { ExternalLink, Share2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyBadge } from '@/components/faro/emergency-badge'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { VerificationBadge } from '@/components/trust/verification-badge'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { cn, timeAgo } from '@/lib/utils'
import type { Need, Report, Site } from '@/lib/types'

export function CenterQuickSheet({
  site,
  address,
  confidence,
  priority,
  topNeeds,
  hiddenNeeds,
  onNavigate,
  onShare,
  onOpenDetail,
}: {
  site: Site
  address: string
  confidence: 'Verificado' | 'Pendiente'
  priority: 'Alta' | 'Media' | 'Baja'
  topNeeds: string[]
  hiddenNeeds: number
  onNavigate: () => void
  onShare: () => void
  onOpenDetail: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">{centerTypeLabel(site.type)}</p>
          <p className="truncate text-[17px] font-semibold text-ink">{site.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-ink-subtle">{address}</p>
          <p className="text-[11px] text-ink-faint">Actualizado {timeAgo(site.updatedAt)}</p>
        </div>
        <EmergencyBadge status={site.status} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricPill label="Confianza" value={confidence} tone={confidence === 'Verificado' ? 'operational' : 'warning'} />
        <MetricPill label="Prioridad" value={priority} tone={priority === 'Alta' ? 'critical' : priority === 'Media' ? 'warning' : 'operational'} />
      </div>

      <div className="rounded-2xl bg-white/[0.04] p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">Necesidades clave</p>
        <ul className="mt-1.5 space-y-1">
          {topNeeds.length ? (
            topNeeds.map((need) => (
              <li key={need} className="text-sm text-ink">
                <NeedItemLabel name={need} />
              </li>
            ))
          ) : (
            <li className="text-sm text-ink-subtle">Sin necesidades activas críticas.</li>
          )}
        </ul>
        {hiddenNeeds > 0 && <p className="mt-1 text-xs text-ink-subtle">+{hiddenNeeds} más</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <EmergencyButton variant="primary" size="lg" onClick={onNavigate}>
          <ExternalLink className="h-4 w-4" /> Navegar
        </EmergencyButton>
        <EmergencyButton variant="glass" size="lg" onClick={onShare}>
          <Share2 className="h-4 w-4" /> Compartir
        </EmergencyButton>
      </div>
      <EmergencyButton variant="glass" size="md" className="w-full" onClick={onOpenDetail}>
        Ver detalles
      </EmergencyButton>
    </div>
  )
}

export function CenterProfileHeader({
  site,
  address,
  confidence,
  priority,
}: {
  site: Site
  address: string
  confidence: 'Verificado' | 'Pendiente'
  priority: 'Alta' | 'Media' | 'Baja'
}) {
  return (
    <GlassCard className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">{centerTypeLabel(site.type)}</p>
          <h2 className="text-xl font-semibold text-ink">{site.name}</h2>
          <p className="text-sm text-ink-muted">{address}</p>
          <p className="text-xs text-ink-faint">Última actualización {timeAgo(site.updatedAt)}</p>
        </div>
        <EmergencyBadge status={site.status} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricPill label="Confianza" value={confidence} tone={confidence === 'Verificado' ? 'operational' : 'warning'} />
        <MetricPill label="Prioridad" value={priority} tone={priority === 'Alta' ? 'critical' : priority === 'Media' ? 'warning' : 'operational'} />
      </div>
    </GlassCard>
  )
}

export function CenterStatusSummary({ summary }: { summary: string }) {
  return (
    <GlassCard className="space-y-1.5">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">Estado actual</p>
      <p className="text-sm leading-relaxed text-ink">{summary}</p>
    </GlassCard>
  )
}

export function HumanCapacityCard({
  pct,
  current,
  total,
}: {
  pct: number
  current: number
  total: number
}) {
  const level = pct >= 85 ? 'Alta' : pct >= 60 ? 'Media' : 'Baja'
  return (
    <CapacityCard
      title="Saturación de personas"
      level={level}
      pct={pct}
      note={`${current} / ${total} personas`}
    />
  )
}

export function InventoryCapacityCard({ availabilityPct }: { availabilityPct: number }) {
  const level = availabilityPct < 40 ? 'Alta' : availabilityPct < 70 ? 'Media' : 'Baja'
  return (
    <CapacityCard
      title="Saturación de productos"
      level={level}
      pct={availabilityPct}
      note="Inventario disponible"
      invert
    />
  )
}

export function CriticalNeedsSection({ needs }: { needs: Need[] }) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Necesidades críticas</p>
      <GlassCard className="space-y-2.5">
        {needs.length ? (
          needs.map((need) => (
            <div key={need.id} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <NeedItemLabel name={need.type} className="text-sm text-ink" />
                <span className="text-xs text-ink-subtle">{priorityLabel(need.priority)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Requerido {need.required} · Disponible {need.available}
              </p>
              <p className="text-[11px] text-ink-faint">Actualizado {timeAgo(need.updatedAt)}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-subtle">Sin necesidades activas prioritarias.</p>
        )}
      </GlassCard>
    </section>
  )
}

export function InventoryHighlights({ items }: { items: string[] }) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Inventario destacado</p>
      <GlassCard className="flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-ink-muted">
              {item}
            </span>
          ))
        ) : (
          <p className="text-sm text-ink-subtle">Sin elementos destacados por ahora.</p>
        )}
      </GlassCard>
    </section>
  )
}

export function CenterTimeline({
  items,
}: {
  items: Array<{ id: string; title: string; when: string; author: string; state: string }>
}) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Historial de actualizaciones</p>
      <GlassCard className="space-y-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-white/[0.04] px-3 py-2">
              <p className="text-sm text-ink">{item.title}</p>
              <p className="mt-1 text-[11px] text-ink-subtle">
                {item.when} · {item.author} · {item.state}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-subtle">Sin movimientos recientes.</p>
        )}
      </GlassCard>
    </section>
  )
}

export function CitizenReportsPreview({ reports }: { reports: Report[] }) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        Reportes ciudadanos
      </p>
      <GlassCard className="space-y-2">
        {reports.length ? (
          reports.map((report) => (
            <div key={report.id} className="space-y-2 rounded-2xl bg-white/[0.04] px-3 py-2.5">
              <VerificationBadge
                kind={report.status === 'verified' ? 'verified' : 'citizen_pending'}
                validatedBy={report.status === 'verified' ? 'Coordinador del centro' : undefined}
              />
              <p className="text-sm text-ink">{report.description}</p>
              <p className="text-[11px] text-ink-subtle">
                {timeAgo(report.createdAt)} · {report.type}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-subtle">Sin reportes ciudadanos recientes.</p>
        )}
      </GlassCard>
    </section>
  )
}

export function CenterActions({
  onNavigate,
  onShare,
  onReport,
}: {
  onNavigate: () => void
  onShare: () => void
  onReport: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <EmergencyButton variant="primary" size="lg" onClick={onNavigate}>
        Navegar
      </EmergencyButton>
      <EmergencyButton variant="glass" size="lg" onClick={onShare}>
        Compartir
      </EmergencyButton>
      <EmergencyButton variant="glass" size="lg" onClick={onReport}>
        Reportar información
      </EmergencyButton>
    </div>
  )
}

function CapacityCard({
  title,
  level,
  pct,
  note,
  invert,
}: {
  title: string
  level: 'Alta' | 'Media' | 'Baja'
  pct: number
  note: string
  invert?: boolean
}) {
  const tone =
    level === 'Alta' ? 'text-critical' : level === 'Media' ? 'text-warning' : 'text-operational'
  const barWidth = `${Math.max(3, Math.min(100, invert ? pct : pct))}%`
  return (
    <GlassCard className="space-y-2">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">{title}</p>
      <p className={cn('text-sm font-medium', tone)}>{level}</p>
      <p className="text-[26px] font-semibold leading-none text-ink">{pct}%</p>
      <p className="text-xs text-ink-subtle">{note}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            'h-full rounded-full',
            level === 'Alta'
              ? 'bg-critical'
              : level === 'Media'
                ? 'bg-warning'
                : 'bg-operational',
          )}
          style={{ width: barWidth }}
        />
      </div>
    </GlassCard>
  )
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'critical' | 'warning' | 'operational'
}) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</p>
      <p
        className={cn(
          'text-sm font-medium',
          tone === 'critical'
            ? 'text-critical'
            : tone === 'warning'
              ? 'text-warning'
              : 'text-operational',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function centerTypeLabel(type: Site['type']) {
  if (type === 'hospital') return 'Hospital'
  if (type === 'shelter') return 'Refugio'
  return 'Centro de Acopio'
}

function priorityLabel(priority: Need['priority']) {
  if (priority === 'critical') return 'Alta'
  if (priority === 'high') return 'Media'
  return 'Baja'
}
