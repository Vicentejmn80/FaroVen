import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useReportAnalysis } from '@/hooks/useCaseManager'
import { cn } from '@/lib/utils'

interface ReportDetailPanelProps {
  reportId: string | null
  onClose: () => void
  onConvertToCase: (reportId: string) => void
}

function centerTypeLabel(type: string): string {
  const labels: Record<string, string> = { hospital: 'Hospital', shelter: 'Refugio', supply_center: 'Centro de suministro' }
  return labels[type] ?? type
}

function centerTypeColor(type: string): string {
  const colors: Record<string, string> = { hospital: 'bg-blue-500/20 text-blue-400', shelter: 'bg-amber-500/20 text-amber-400', supply_center: 'bg-emerald-500/20 text-emerald-400' }
  return colors[type] ?? 'bg-white/10 text-ink-subtle'
}

export function ReportDetailPanel({ reportId, onClose, onConvertToCase }: ReportDetailPanelProps) {
  const { data: analysis, isLoading } = useReportAnalysis(reportId)

  if (!reportId) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h2 className="text-sm font-semibold text-ink">Detalle del reporte</h2>
        <button onClick={onClose} className="text-xs text-ink-subtle hover:text-ink">Cerrar</button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <GlassCard key={i} className="h-20 animate-pulse" />)}
          </div>
        ) : !analysis ? (
          <GlassCard className="p-4 text-sm text-ink-subtle text-center">Reporte no encontrado</GlassCard>
        ) : (
          <>
            <GlassCard className="p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', analysis.report.status === 'verified' ? 'bg-operational/20 text-operational' : analysis.report.status === 'discarded' ? 'bg-critical/20 text-critical' : 'bg-warning/20 text-warning')}>
                    {analysis.report.status === 'verified' ? 'Verificado' : analysis.report.status === 'discarded' ? 'Descartado' : 'Nuevo'}
                  </span>
                </div>
                <span className="text-xs text-ink-muted">{analysis.report.createdAt.toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-ink mb-2">{analysis.report.description}</p>
              <p className="text-xs text-ink-subtle">Ubicación: {analysis.report.location.address}</p>
              <p className="text-xs text-ink-subtle">Fuente: {analysis.report.source}</p>
            </GlassCard>

            {analysis.duplicates.length > 0 && (
              <GlassCard className="p-3 border-warning/20">
                <p className="text-xs font-semibold text-warning mb-2">Posibles duplicados ({analysis.duplicates.length})</p>
                <div className="space-y-2">
                  {analysis.duplicates.slice(0, 5).map((dup) => (
                    <div key={dup.id} className="flex items-start justify-between gap-2 text-xs">
                      <p className="text-ink-subtle line-clamp-1 flex-1">{dup.description}</p>
                      <span className="shrink-0 text-ink-muted">{dup.score}%</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            <GlassCard className="p-3">
              <p className="text-xs font-semibold text-ink mb-2">Centros cercanos</p>
              <div className="space-y-2">
                {analysis.nearbyCenters.length === 0 && <p className="text-xs text-ink-muted">No se encontraron centros cercanos</p>}
                {analysis.nearbyCenters.map((center) => (
                  <div key={center.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{center.name}</p>
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium', centerTypeColor(center.type))}>
                          {centerTypeLabel(center.type)}
                        </span>
                        <span>{center.distance} km</span>
                        {center.capacity !== undefined && (
                          <span>Ocupación: {Math.round(((center.currentOcc ?? 0) / Math.max(center.capacity, 1)) * 100)}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-3">
              <p className="text-xs font-semibold text-ink mb-2">Contexto operacional</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/[0.04] rounded-lg p-2">
                  <p className="text-ink-muted">Reportes similares</p>
                  <p className="text-lg font-semibold text-ink">{analysis.duplicates.length}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-2">
                  <p className="text-ink-muted">Centros cercanos</p>
                  <p className="text-lg font-semibold text-ink">{analysis.nearbyCenters.length}</p>
                </div>
              </div>
            </GlassCard>

            <div className="flex gap-2 pt-2">
              <EmergencyButton variant="primary" size="sm" className="flex-1" onClick={() => onConvertToCase(analysis.report.id)}>
                Convertir a caso
              </EmergencyButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
