import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Users, MapPin, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import { label, SKILL_LABELS } from '@/lib/labels'
import { useCaseApplications, useApproveCaseApplication, useRejectCaseApplication } from '@/hooks/useCaseApplications'
import { useOpenCaseForApplications } from '@/hooks/useCases'
import { caseApplicationService } from '@/services/case-application-service'
import { useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import type { CaseDomain } from '@/domain/case-lifecycle.types'

interface EsperarPostulanteModalProps {
  caseData: CaseDomain
  open: boolean
  onClose: () => void
  onTimeUp: () => void
}

const TIME_OPTIONS = [
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '30 min', value: 1800 },
  { label: '∞', value: Infinity },
]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function EsperarPostulanteModal({ caseData, open, onClose, onTimeUp }: EsperarPostulanteModalProps) {
  const [step, setStep] = useState<'select-time' | 'waiting' | 'results'>('select-time')
  const [selectedTime, setSelectedTime] = useState<number>(300)
  const [timeLeft, setTimeLeft] = useState<number>(300)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { data: applications = [] } = useCaseApplications(open ? caseData.id : undefined)
  const approveApp = useApproveCaseApplication()
  const rejectApp = useRejectCaseApplication()
  const openForApps = useOpenCaseForApplications()
  const qc = useQueryClient()
  const startedRef = useRef(false)

  const pendingApps = useMemo(() => applications.filter((a) => a.status === 'pending' || a.status === 'under_review'), [applications])
  const historyApps = useMemo(() => applications.filter((a) => a.status !== 'pending' && a.status !== 'under_review'), [applications])

  useEffect(() => {
    if (!open) {
      setStep('select-time')
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
  }, [open])

  const startWaiting = () => {
    if (startedRef.current) return
    startedRef.current = true

    setTimeLeft(selectedTime)
    setStep('waiting')

    // Transition case to open_for_applications + notify volunteers
    openForApps.mutate(
      { caseId: caseData.id, comment: 'Caso abierto a postulaciones voluntarias' },
      {
        onSuccess: () => {
          caseApplicationService.notifyVolunteersAboutCase(caseData)
          qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
          qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
        },
      },
    )

    if (selectedTime === Infinity) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          setStep('results')
          onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopWaiting = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setStep('results')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#0A0F1A]/95 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0A0F1A] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-info/20">
              <Users className="h-3.5 w-3.5 text-info" />
            </div>
            <h2 className="text-sm font-semibold text-ink">Esperar postulante</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-faint hover:bg-white/[0.06] hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Case info */}
          <GlassCard className="p-3">
            <p className="text-sm font-medium text-ink">{caseData.title}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
              <MapPin className="h-3 w-3" />
              <span>{caseData.zone}</span>
              <span className="text-ink-faint">&middot;</span>
              <Clock className="h-3 w-3" />
              <span>{label({ critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' }, caseData.priority)}</span>
            </div>
          </GlassCard>

          {/* Step 1: Select time */}
          {step === 'select-time' && (
            <div className="space-y-4">
              <p className="text-xs text-ink-muted text-center">
                ¿Cuánto tiempo esperarás postulaciones?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedTime(opt.value)}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-center transition-all',
                      selectedTime === opt.value
                        ? 'border-info/50 bg-info/15 text-info'
                        : 'border-white/[0.08] text-ink-subtle hover:bg-white/[0.04]',
                    )}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    {opt.value !== Infinity && (
                      <p className="mt-0.5 text-[10px] text-ink-faint">
                        {opt.value >= 600 ? `${opt.value / 60} min` : `${opt.value / 60} min`}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              <EmergencyButton className="w-full" onClick={startWaiting}>
                Iniciar espera
              </EmergencyButton>
            </div>
          )}

          {/* Step 2: Waiting with radar */}
          {step === 'waiting' && (
            <div className="space-y-5">
              {/* Radar animation */}
              <div className="relative flex items-center justify-center py-8">
                {/* Radar rings */}
                <div className="absolute h-48 w-48 rounded-full border border-info/10" />
                <div className="absolute h-36 w-36 rounded-full border border-info/15" />
                <div className="absolute h-24 w-24 rounded-full border border-info/20" />
                <div className="absolute h-12 w-12 rounded-full border border-info/30" />

                {/* Spinning radar line */}
                <div className="absolute h-48 w-48 animate-spin" style={{ animationDuration: '3s' }}>
                  <div className="mx-auto h-24 w-0.5 origin-bottom bg-gradient-to-t from-transparent via-info/60 to-info" style={{ transform: 'rotate(0deg)' }} />
                </div>

                {/* Center icon */}
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-info/20 ring-2 ring-info/30">
                  <Users className="h-7 w-7 text-info" />
                </div>
              </div>

              {/* Timer */}
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums text-ink">{formatTime(timeLeft)}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {pendingApps.length === 0
                    ? 'Esperando postulantes...'
                    : `${pendingApps.length} postulante${pendingApps.length === 1 ? '' : 's'} recibido${pendingApps.length === 1 ? '' : 's'}`}
                </p>
              </div>

              {/* Live applicants */}
              {pendingApps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    Postulaciones recibidas ({pendingApps.length})
                  </p>
                  {pendingApps.map((app) => (
                    <GlassCard key={app.id} className="border-info/20 bg-info/[0.03] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{app.applicantName}</p>
                          {app.organization && <p className="text-xs text-ink-subtle">{app.organization}</p>}
                        </div>
                        <span className="shrink-0 animate-pulse rounded-full bg-operational/20 px-2 py-0.5 text-[10px] font-medium text-operational">
                          Nuevo
                        </span>
                      </div>
                      {app.message && <p className="mt-1 text-xs text-ink-muted">{app.message}</p>}
                      {app.skills && app.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {app.skills.map((s) => (
                            <span key={s} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-faint">{label(SKILL_LABELS, s, s)}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => approveApp.mutate({ applicationId: app.id, operatorId: '' })}
                          disabled={approveApp.isPending}
                          className="flex-1 rounded-lg bg-operational/15 py-1.5 text-xs font-medium text-operational hover:bg-operational/25"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => rejectApp.mutate({ applicationId: app.id, operatorId: '' })}
                          disabled={rejectApp.isPending}
                          className="flex-1 rounded-lg bg-critical/15 py-1.5 text-xs font-medium text-critical hover:bg-critical/25"
                        >
                          Rechazar
                        </button>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {selectedTime !== Infinity && (
                  <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={stopWaiting}>
                    Detener espera
                  </EmergencyButton>
                )}
                <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={onClose}>
                  Cerrar
                </EmergencyButton>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'results' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-lg font-semibold text-ink">
                  {pendingApps.length > 0
                    ? `${pendingApps.length} postulante${pendingApps.length === 1 ? '' : 's'}`
                    : 'Sin postulaciones'}
                </p>
                <p className="text-xs text-ink-muted mt-1">
                  {pendingApps.length > 0
                    ? 'Revisa y aprueba a los postulantes'
                    : 'Nadie se postuló en este tiempo. Puedes intentar de nuevo o asignar manualmente.'}
                </p>
              </div>

              {pendingApps.length === 0 && (
                <div className="flex gap-2">
                  <EmergencyButton variant="primary" size="sm" className="flex-1" onClick={() => setStep('select-time')}>
                    Intentar de nuevo
                  </EmergencyButton>
                  <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={onClose}>
                    Cerrar
                  </EmergencyButton>
                </div>
              )}

              {pendingApps.map((app) => (
                <GlassCard key={app.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{app.applicantName}</p>
                      {app.organization && <p className="text-xs text-ink-subtle">{app.organization}</p>}
                      {app.trustScore !== undefined && (
                        <p className="text-[10px] text-ink-faint mt-0.5">Confianza: {app.trustScore}%</p>
                      )}
                    </div>
                    <span className={cn('shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', 'bg-warning/15 text-warning')}>
                      Pendiente
                    </span>
                  </div>
                  {app.message && <p className="mt-1 text-xs text-ink-muted">{app.message}</p>}
                  {app.skills && app.skills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {app.skills.map((s) => (
                        <span key={s} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-faint">{label(SKILL_LABELS, s, s)}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => approveApp.mutate({ applicationId: app.id, operatorId: '' })}
                      disabled={approveApp.isPending}
                      className="flex-1 rounded-lg bg-operational/15 py-1.5 text-xs font-medium text-operational hover:bg-operational/25"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => rejectApp.mutate({ applicationId: app.id, operatorId: '' })}
                      disabled={rejectApp.isPending}
                      className="flex-1 rounded-lg bg-critical/15 py-1.5 text-xs font-medium text-critical hover:bg-critical/25"
                    >
                      Rechazar
                    </button>
                  </div>
                </GlassCard>
              ))}

              {/* History */}
              {historyApps.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Historial</p>
                  {historyApps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2">
                      <p className="text-xs text-ink">{app.applicantName}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', app.status === 'approved' ? 'bg-operational/15 text-operational' : 'bg-critical/15 text-critical')}>
                        {app.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
