import { Sparkles, AlertTriangle, Building2, ShieldCheck, User, Phone, Mail } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useReportAnalysis } from '@/hooks/useCaseManager'
import { useDeleteReport } from '@/hooks/useReports'
import { cn } from '@/lib/utils'
import { SITE_TYPE_LABELS, confidenceBand, label, REPORT_STATUS_LABELS } from '@/lib/labels'

interface ReportDetailPanelProps {
  reportId: string | null
  onClose: () => void
  onConvertToCase: (reportId: string) => void
}

function centerTypeColor(type: string): string {
  const colors: Record<string, string> = {
    hospital: 'bg-blue-500/20 text-blue-400',
    shelter: 'bg-amber-500/20 text-amber-400',
    supply_center: 'bg-emerald-500/20 text-emerald-400',
  }
  return colors[type] ?? 'bg-white/10 text-ink-subtle'
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    citizen: 'Ciudadano',
    volunteer: 'Voluntario',
    coordinator: 'Coordinador',
    system: 'Sistema',
    web: 'Portal web',
  }
  return map[source] ?? 'Reporte ciudadano'
}

export function ReportDetailPanel({ reportId, onClose, onConvertToCase }: ReportDetailPanelProps) {
  const { data: analysis, isLoading } = useReportAnalysis(reportId)
  const deleteReport = useDeleteReport()

  if (!reportId) return null

  const parseContactInfo = (raw?: string) => {
    if (!raw) return null
    const parts = raw.split('|').map((p) => p.trim())
    return {
      name: parts[0] || null,
      phone: parts[1] || null,
      email: parts[2] || null,
    }
  }

  const handleDiscard = () => {
    if (window.confirm('¿Descartar este reporte? Se eliminará de la bandeja de entrada.')) {
      deleteReport.mutate(reportId)
      onClose()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Detalle de la solicitud</h2>
        <button type="button" onClick={onClose} className="text-xs text-ink-subtle hover:text-ink">
          Cerrar
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <GlassCard key={i} className="h-20 animate-pulse" />
            ))}
          </div>
        ) : !analysis ? (
          <GlassCard className="p-4 text-center text-sm text-ink-subtle">
            No encontramos esta solicitud
          </GlassCard>
        ) : (
          <>
            <GlassCard className="p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    analysis.report.status === 'verified'
                      ? 'bg-operational/20 text-operational'
                      : analysis.report.status === 'discarded'
                        ? 'bg-critical/20 text-critical'
                        : 'bg-warning/20 text-warning',
                  )}
                >
                  {label(REPORT_STATUS_LABELS, analysis.report.status, 'Solicitud pendiente')}
                </span>
                <span className="text-xs text-ink-muted">
                  {analysis.report.createdAt.toLocaleDateString('es-VE')}
                </span>
              </div>
              <p className="mb-2 text-sm text-ink">{analysis.report.description}</p>
              <p className="text-xs text-ink-subtle">Ubicación: {analysis.report.location.address}</p>
              <p className="text-xs text-ink-subtle">Origen: {sourceLabel(analysis.report.source)}</p>
            </GlassCard>

            {(() => {
              const contact = parseContactInfo(analysis.report.contactInfo)
              if (!contact) return null
              return (
                <GlassCard className="p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-2">Información de contacto</p>
                  <div className="space-y-1.5">
                    {contact.name && (
                      <div className="flex items-center gap-2 text-xs text-ink">
                        <User className="h-3 w-3 text-ink-subtle" />
                        <span>{contact.name}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-xs text-ink">
                        <Phone className="h-3 w-3 text-ink-subtle" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-xs text-ink">
                        <Mail className="h-3 w-3 text-ink-subtle" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )
            })()}

            {analysis.duplicates.length > 0 && (
              <GlassCard className="border-warning/25 bg-warning/[0.04] p-3.5">
                <div className="mb-2.5 flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Información similar cerca de esta zona
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      La inteligencia operacional detectó {analysis.duplicates.length} reporte
                      {analysis.duplicates.length === 1 ? '' : 's'} relacionado
                      {analysis.duplicates.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {analysis.duplicates.slice(0, 5).map((dup) => (
                    <div
                      key={dup.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                    >
                      <p className="line-clamp-2 text-xs text-ink-subtle">{dup.description}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                          {confidenceBand(dup.score)}
                        </span>
                        <span className="text-[10px] text-ink-faint">Posible coincidencia</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            <GlassCard className="p-3.5">
              <div className="mb-2.5 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-info" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Centros recomendados
                </p>
              </div>
              <div className="space-y-2">
                {analysis.nearbyCenters.length === 0 && (
                  <p className="text-xs text-ink-muted">No hay centros cercanos disponibles</p>
                )}
                {analysis.nearbyCenters.map((center, idx) => (
                  <div key={center.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {idx === 0 && (
                          <span className="rounded-full bg-info/15 px-1.5 py-0.5 text-[9px] font-semibold text-info">
                            Recomendado
                          </span>
                        )}
                        <p className="truncate text-xs font-medium text-ink">{center.name}</p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                        <span
                          className={cn(
                            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                            centerTypeColor(center.type),
                          )}
                        >
                          {label(SITE_TYPE_LABELS, center.type, center.type)}
                        </span>
                        <span>{center.distance} km</span>
                        {center.capacity !== undefined && (
                          <span>
                            Ocupación:{' '}
                            {Math.round(((center.currentOcc ?? 0) / Math.max(center.capacity, 1)) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-3.5">
              <div className="mb-2.5 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-operational" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Contexto operacional
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/[0.04] p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-ink-muted">Reportes relacionados</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{analysis.duplicates.length}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-ink-muted">Centros cercanos</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{analysis.nearbyCenters.length}</p>
                </div>
                <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    <p className="text-xs text-ink-muted">
                      Nivel de prioridad sugerido:{' '}
                      <strong className="text-ink">
                        {analysis.duplicates.length >= 3 ? 'Alta' : analysis.duplicates.length >= 1 ? 'Media' : 'Normal'}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="flex gap-2 pt-2">
              <EmergencyButton
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => onConvertToCase(analysis.report.id)}
              >
                Abrir caso operativo
              </EmergencyButton>
              <EmergencyButton
                variant="glass"
                size="sm"
                disabled={deleteReport.isPending}
                onClick={handleDiscard}
                className="text-critical border-critical/30 hover:bg-critical/15"
              >
                Descartar
              </EmergencyButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
