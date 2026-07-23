import { useState, useMemo } from 'react'
import { X, MapPin, Building2, Shield, Star, AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'
import { useCenters } from '@/hooks/useCenters'
import { assignmentService } from '@/services/assignment-service'
import { useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import type { CaseDomain } from '@/domain/case-lifecycle.types'

interface AsignarCentroModalProps {
  caseData: CaseDomain
  open: boolean
  onClose: () => void
  actorId?: string
}

export function AsignarCentroModal({ caseData, open, onClose, actorId }: AsignarCentroModalProps) {
  const { data: centers = [], isLoading } = useCenters()
  const [assigning, setAssigning] = useState<string | null>(null)
  const qc = useQueryClient()

  const suggestions = useMemo(() => {
    try {
      return assignmentService.suggestCenters(
        caseData,
        centers.map((c) => ({
          id: c.id,
          name: c.name,
          lat: c.location.coordinates.lat,
          lng: c.location.coordinates.lng,
          status: c.status,
          saturation: c.status === 'critical' ? 'critical' : c.status === 'warning' ? 'high' : 'low' as 'low' | 'medium' | 'high' | 'critical',
          activeNeedsCount: c.needIds.length,
        })),
      )
    } catch {
      return []
    }
  }, [centers, caseData])

  const handleAssign = async (centerId: string, centerName: string) => {
    setAssigning(centerId)
    try {
      await assignmentService.assign(
        caseData.id,
        centerId,
        actorId ?? '',
        undefined,
        `Asignado a ${centerName}`,
      )
      await qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      await qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseAssignments] })
      await qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
      onClose()
    } catch (err) {
      console.error('Error assigning center:', err)
    } finally {
      setAssigning(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#0A0F1A]/95 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0A0F1A] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-info/20">
              <Building2 className="h-3.5 w-3.5 text-info" />
            </div>
            <h2 className="text-sm font-semibold text-ink">Asignar a centro</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-faint hover:bg-white/[0.06] hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <GlassCard className="p-3">
            <p className="text-sm font-medium text-ink">{caseData.title}</p>
            <p className="mt-1 text-xs text-ink-muted">{caseData.zone}</p>
          </GlassCard>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <GlassCard key={i} className="h-16 animate-pulse" />)}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-6">
              <AlertTriangle className="mx-auto h-8 w-8 text-warning/60" />
              <p className="mt-2 text-sm text-ink-subtle">No hay centros disponibles cerca</p>
              <p className="text-xs text-ink-faint mt-1">Verifica que existan centros registrados en la zona</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Centros recomendados ({suggestions.length})
              </p>
              {suggestions.map((s, idx) => (
                <div key={s.centerId} className={cn('rounded-xl border p-3 transition-all', assigning === s.centerId ? 'border-info/40 bg-info/10' : 'border-white/[0.08] hover:bg-white/[0.03]')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <Star className="h-3 w-3 text-warning fill-warning" />}
                        <p className="text-sm font-medium text-ink">{s.centerName}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.distance}</span>
                        <span className={cn('rounded-full px-1.5 py-0.5', s.saturation === 'critical' ? 'bg-critical/15 text-critical' : s.saturation === 'high' ? 'bg-warning/15 text-warning' : 'bg-operational/15 text-operational')}>
                          {s.saturation === 'critical' ? 'Saturado' : s.saturation === 'high' ? 'Alta demanda' : 'Disponible'}
                        </span>
                      </div>
                      {s.score > 0 && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <Shield className="h-3 w-3 text-info" />
                          <div className="h-1.5 flex-1 rounded-full bg-white/[0.08] overflow-hidden">
                            <div className="h-full rounded-full bg-info" style={{ width: `${s.score}%` }} />
                          </div>
                          <span className="text-[10px] text-ink-faint">{Math.round(s.score)}%</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleAssign(s.centerId, s.centerName)}
                      disabled={assigning === s.centerId}
                      className="shrink-0 rounded-lg bg-info/15 px-3 py-1.5 text-xs font-medium text-info hover:bg-info/25 transition-colors disabled:opacity-50"
                    >
                      {assigning === s.centerId ? 'Asignando...' : 'Asignar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
