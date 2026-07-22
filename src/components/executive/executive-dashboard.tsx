import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Map,
  Shield,
  TrendingUp,
  Users,
  ListChecks,
  BrainCircuit,
  Globe,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { useExecutiveDashboard } from '@/hooks/useExecutiveDashboard'
import { useOperationalTimeline } from '@/hooks/useOperationalTimeline'
import { cn, timeAgo } from '@/lib/utils'
import { confidenceBand } from '@/lib/labels'
import type { ExecutiveDashboardData } from '@/domain/operational-intelligence.types'

type Tab = 'overview' | 'risk' | 'recommendations' | 'timeline' | 'heatmap' | 'trends'

export function ExecutiveDashboard() {
  const { data, isLoading, error } = useExecutiveDashboard()
  const { data: timeline } = useOperationalTimeline()
  const [tab, setTab] = useState<Tab>('overview')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <Activity className="mx-auto h-8 w-8 text-info animate-pulse" />
          <p className="mt-3 text-sm text-ink-subtle">Cargando inteligencia operacional...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="text-center p-6">
          <AlertTriangle className="mx-auto h-8 w-8 text-critical" />
          <p className="mt-3 text-sm text-critical">Error al cargar el dashboard ejecutivo</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-safe pb-3 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="truncate text-lg font-semibold text-ink">Dashboard Ejecutivo</h1>
          <p className="text-xs text-ink-subtle">Centro de inteligencia operacional</p>
        </div>
        <RiskBadge score={data.risk.score} level={data.risk.level} />
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2 lg:px-8">
        {(['overview', 'risk', 'recommendations', 'timeline', 'heatmap', 'trends'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t
                ? 'border-info/50 bg-info/15 text-ink'
                : 'border-white/10 bg-white/[0.04] text-ink-subtle hover:bg-white/[0.08]',
            )}
          >
            {t === 'overview' && 'Resumen'}
            {t === 'risk' && 'Riesgo'}
            {t === 'recommendations' && 'Recomendaciones'}
            {t === 'timeline' && 'Línea de tiempo'}
            {t === 'heatmap' && 'Mapa de calor'}
            {t === 'trends' && 'Tendencias'}
          </button>
        ))}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-32 lg:px-8 lg:pb-8">
        {tab === 'overview' && <OverviewTab data={data} timeline={timeline ?? []} />}
        {tab === 'risk' && <RiskTab data={data} />}
        {tab === 'recommendations' && <RecommendationsTab data={data} />}
        {tab === 'timeline' && <TimelineTab entries={timeline ?? []} />}
        {tab === 'heatmap' && <HeatMapTab data={data} />}
        {tab === 'trends' && <TrendsTab data={data} />}
      </div>
    </div>
  )
}

function RiskBadge({ score, level }: { score: number; level: string }) {
  const colors: Record<string, string> = {
    low: 'bg-operational/15 text-operational',
    medium: 'bg-warning/15 text-warning',
    high: 'bg-critical/15 text-critical',
    critical: 'bg-critical/25 text-critical',
  }
  const labels: Record<string, string> = {
    low: 'Bajo',
    medium: 'Medio',
    high: 'Alto',
    critical: 'Crítico',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', colors[level])}>
      <Shield className="h-3.5 w-3.5" />
      {labels[level] ?? 'Riesgo'} · {confidenceBand(score)}
    </span>
  )
}

function MetricCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <GlassCard className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', tone ?? 'text-info')} />
        <span className="text-xs text-ink-subtle">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', tone ?? 'text-ink')}>{value}</p>
      {sub && <p className="text-[10px] text-ink-faint">{sub}</p>}
    </GlassCard>
  )
}

function OverviewTab({ data, timeline }: { data: ExecutiveDashboardData; timeline: any[] }) {
  const m = data.metrics
  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Activity} label="Casos activos" value={m.totalCases} sub={`${m.criticalCases} críticos`} tone={m.criticalCases > 0 ? 'text-critical' : undefined} />
        <MetricCard icon={Users} label="Voluntarios" value={m.activeVolunteers} sub={`${m.availableVolunteers} disponibles`} tone={m.availableVolunteers === 0 ? 'text-critical' : undefined} />
        <MetricCard icon={Shield} label="Misiones activas" value={m.activeMissions} sub={`${m.criticalMissions} críticas`} tone={m.criticalMissions > 0 ? 'text-critical' : undefined} />
        <MetricCard icon={AlertTriangle} label="Plazos vencidos" value={m.breachedSlaCount} tone={m.breachedSlaCount > 0 ? 'text-critical' : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard icon={Globe} label="Reportes totales" value={m.totalReports} sub={`${m.pendingReports} pendientes`} />
        <MetricCard icon={Clock} label="Tiempo promedio" value={`${m.avgAttentionMinutes} min`} sub="atención" />
        <MetricCard icon={BarChart3} label="Centros" value={`${m.operationalCenters} ops`} sub={`${m.saturatedCenters} saturados`} />
      </div>

      {data.recommendations.filter((r) => r.priority === 'critical').length > 0 && (
        <GlassCard className="space-y-2 border-l-2 border-critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-critical" />
            <span className="text-sm font-semibold text-critical">Recomendaciones críticas</span>
          </div>
          {data.recommendations.filter((r) => r.priority === 'critical').slice(0, 3).map((r) => (
            <p key={r.id} className="text-xs text-ink-subtle">{r.action} — {r.reason}</p>
          ))}
        </GlassCard>
      )}

      {timeline.length > 0 && (
        <GlassCard className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Actividad reciente</h3>
          <div className="space-y-1.5">
            {timeline.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 text-xs text-ink-muted">
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  entry.severity === 'critical' ? 'bg-critical' : entry.severity === 'warning' ? 'bg-warning' : 'bg-info',
                )} />
                <span className="text-ink-subtle">{entry.title}</span>
                <span className="ml-auto">{timeAgo(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {data.decisions.length > 0 && (
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-info" />
            <h3 className="text-sm font-semibold text-ink">Decisiones operacionales</h3>
          </div>
          {data.decisions.map((d, i) => (
            <div key={i} className={cn(
              'rounded-lg border p-3',
              d.severity === 'critical' ? 'border-critical/30 bg-critical/10' : d.severity === 'warning' ? 'border-warning/30 bg-warning/10' : 'border-white/10',
            )}>
              <p className="text-xs font-medium text-ink">{d.question}</p>
              <p className="mt-1 text-xs text-ink-subtle">{d.answer}</p>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  )
}

function RiskTab({ data }: { data: ExecutiveDashboardData }) {
  return (
    <div className="space-y-4 pt-2">
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Factores de riesgo</h3>
          <RiskBadge score={data.risk.score} level={data.risk.level} />
        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              data.risk.level === 'critical' ? 'bg-critical' : data.risk.level === 'high' ? 'bg-warning' : data.risk.level === 'medium' ? 'bg-warning/70' : 'bg-operational',
            )}
            style={{ width: `${data.risk.score}%` }}
          />
        </div>

        {data.risk.factors.map((f) => (
          <div key={f.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-subtle">{f.name}</span>
              <span className={cn(
                f.status === 'critical' ? 'text-critical' : f.status === 'elevated' ? 'text-warning' : 'text-ink-muted',
              )}>
                Aporte alto · {confidenceBand(f.score)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  f.status === 'critical' ? 'bg-critical' : f.status === 'elevated' ? 'bg-warning' : 'bg-operational',
                )}
                style={{ width: `${f.score}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-faint">{f.detail}</p>
          </div>
        ))}
      </GlassCard>
    </div>
  )
}

function RecommendationsTab({ data }: { data: ExecutiveDashboardData }) {
  const sorted = [...data.recommendations].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.priority] - order[b.priority]
  })

  if (sorted.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <ListChecks className="mx-auto h-8 w-8 text-operational" />
        <p className="mt-3 text-sm text-ink-subtle">No hay recomendaciones pendientes</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      {sorted.map((r) => (
        <GlassCard key={r.id} className={cn(
          'space-y-2 border-l-2',
          r.priority === 'critical' ? 'border-l-critical' : r.priority === 'high' ? 'border-l-warning' : 'border-l-info/30',
        )}>
          <div className="flex items-center justify-between">
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              r.priority === 'critical' ? 'bg-critical/20 text-critical' : r.priority === 'high' ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info',
            )}>
              {r.priority === 'critical' ? 'Crítica' : r.priority === 'high' ? 'Alta' : r.priority === 'medium' ? 'Media' : 'Baja'}
            </span>
            <span className="text-[10px] text-ink-faint">{confidenceBand(r.confidence)}</span>
          </div>
          <h4 className="text-sm font-semibold text-ink">{r.action}</h4>
          <p className="text-xs text-ink-subtle">{r.description}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <p className="text-[10px] text-ink-faint">Por qué</p>
              <p className="text-xs text-ink-muted">{r.reason}</p>
            </div>
            <div>
              <p className="text-[10px] text-ink-faint">Impacto esperado</p>
              <p className="text-xs text-ink-muted">{r.expectedImpact}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

function TimelineTab({ entries }: { entries: any[] }) {
  if (entries.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <Clock className="mx-auto h-8 w-8 text-ink-faint" />
        <p className="mt-3 text-sm text-ink-subtle">No hay eventos en la línea de tiempo</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-2 pt-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <span className={cn(
              'h-2.5 w-2.5 rounded-full mt-1',
              entry.severity === 'critical' ? 'bg-critical' : entry.severity === 'warning' ? 'bg-warning' : 'bg-info',
            )} />
            <div className="w-px flex-1 bg-white/10 min-h-[24px]" />
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink">{entry.title}</span>
              <span className="text-[10px] text-ink-faint">{timeAgo(entry.timestamp)}</span>
            </div>
            <p className="text-xs text-ink-subtle">{entry.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function HeatMapTab({ data }: { data: ExecutiveDashboardData }) {
  const zones = data.heatZones
  if (zones.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <Map className="mx-auto h-8 w-8 text-ink-faint" />
        <p className="mt-3 text-sm text-ink-subtle">No hay zonas para mostrar</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      {zones.map((zone) => (
        <GlassCard key={zone.id} className={cn(
          'space-y-2 border-l-2',
          zone.classification === 'critical' ? 'border-l-critical' : zone.classification === 'hot' ? 'border-l-warning' : zone.classification === 'no_coverage' ? 'border-l-ink-faint' : 'border-l-operational',
        )}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">{zone.name}</h4>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              zone.classification === 'critical' ? 'bg-critical/20 text-critical' : zone.classification === 'hot' ? 'bg-warning/20 text-warning' : zone.classification === 'no_coverage' ? 'bg-white/10 text-ink-faint' : 'bg-operational/20 text-operational',
            )}>
              {zone.classification === 'critical' ? 'Crítica' : zone.classification === 'hot' ? 'Alta presión' : zone.classification === 'no_coverage' ? 'Sin cobertura' : 'Estable'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-ink-faint">Casos: </span>
              <span className="text-ink-subtle">{zone.caseCount}</span>
            </div>
            <div>
              <span className="text-ink-faint">Reportes: </span>
              <span className="text-ink-subtle">{zone.reportCount}</span>
            </div>
            <div>
              <span className="text-ink-faint">Recursos: </span>
              <span className="text-ink-subtle">{zone.resourceScore}%</span>
            </div>
          </div>
          {zone.trend && (
            <p className="text-[10px] text-ink-faint">
              Tendencia: {zone.trend === 'up' ? '↑ Al alza' : zone.trend === 'surge' ? '↑↑ Escalada' : zone.trend === 'down' ? '↓ A la baja' : '→ Estable'}
            </p>
          )}
        </GlassCard>
      ))}
    </div>
  )
}

function TrendsTab({ data }: { data: ExecutiveDashboardData }) {
  const trends = data.trends
  if (trends.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <TrendingUp className="mx-auto h-8 w-8 text-ink-faint" />
        <p className="mt-3 text-sm text-ink-subtle">No hay datos de tendencias disponibles</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      {trends.map((t, i) => (
        <GlassCard key={i} className={cn(
          'space-y-2',
          t.isAlert ? 'border-l-2 border-l-critical' : '',
        )}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">{t.metric}</h4>
            <span className={cn(
              'text-xs font-medium',
              t.direction === 'up' || t.direction === 'surge' ? 'text-critical' : t.direction === 'down' || t.direction === 'collapse' ? 'text-warning' : 'text-ink-muted',
            )}>
              {t.changePercent > 0 ? '+' : ''}{t.changePercent}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-lg',
              t.direction === 'up' ? 'text-critical' : t.direction === 'surge' ? 'text-critical' : t.direction === 'down' ? 'text-warning' : t.direction === 'collapse' ? 'text-warning' : 'text-ink-muted',
            )}>
              {t.direction === 'up' || t.direction === 'surge' ? '↑' : t.direction === 'down' || t.direction === 'collapse' ? '↓' : '→'}
            </span>
            <span className="text-xs text-ink-subtle">Actual: {t.currentValue} · Anterior: {t.previousValue}</span>
          </div>
          {t.alertMessage && (
            <p className="text-xs text-critical">{t.alertMessage}</p>
          )}
        </GlassCard>
      ))}

      {data.decisions.length > 0 && (
        <GlassCard className="space-y-2">
          <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-info" />
            Insights operacionales
          </h4>
          {data.decisions.map((d, i) => (
            <p key={i} className="text-xs text-ink-subtle">• {d.question}: {d.answer}</p>
          ))}
        </GlassCard>
      )}
    </div>
  )
}
