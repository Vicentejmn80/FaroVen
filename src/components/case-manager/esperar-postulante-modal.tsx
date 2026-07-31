import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { X, Users, MapPin, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import { label, SKILL_LABELS } from '@/lib/labels'
import { useCaseApplications, useApproveCaseApplication, useRejectCaseApplication } from '@/hooks/useCaseApplications'
import { useOpenCaseForApplications } from '@/hooks/useCases'
import { useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import {
  computeRemainingSeconds,
  loadRadarSession,
  saveRadarSession,
  type RadarSession,
  type RadarUiStep,
} from '@/domain/radar-session'

interface EsperarPostulanteModalProps {
  caseData: CaseDomain
  open: boolean
  onClose: () => void
  /** Solo notifica fin de cuenta atrás. NO debe cerrar el modal. */
  onTimeUp?: () => void
  actorId?: string
}

const TIME_OPTIONS = [
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '30 min', value: 1800 },
  { label: '∞', value: Infinity },
]

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function sessionFromCase(
  caseData: CaseDomain,
  partial: Partial<RadarSession> & Pick<RadarSession, 'step' | 'selectedSeconds'>,
): RadarSession {
  return {
    caseId: caseData.id,
    caseTitle: caseData.title,
    caseZone: caseData.zone,
    casePriority: caseData.priority,
    ...partial,
  }
}

export function EsperarPostulanteModal({
  caseData,
  open,
  onClose,
  onTimeUp,
  actorId,
}: EsperarPostulanteModalProps) {
  const restored = useMemo(() => {
    const s = loadRadarSession()
    return s?.caseId === caseData.id ? s : null
  }, [caseData.id])

  const [step, setStep] = useState<RadarUiStep>(restored?.step ?? 'select-time')
  const [selectedTime, setSelectedTime] = useState<number>(restored?.selectedSeconds ?? 300)
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    restored?.step === 'waiting'
      ? computeRemainingSeconds(restored.deadlineAt)
      : restored?.selectedSeconds ?? 300,
  )
  const [apiError, setApiError] = useState<string | null>(null)
  const [openingCall, setOpeningCall] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineRef = useRef<number | null | undefined>(restored?.deadlineAt)
  const startedRef = useRef(restored?.step === 'waiting' || restored?.step === 'results')
  const timeUpFiredRef = useRef(false)

  const { data: applications = [] } = useCaseApplications(open ? caseData.id : undefined)
  const approveApp = useApproveCaseApplication()
  const rejectApp = useRejectCaseApplication()
  const openForApps = useOpenCaseForApplications()
  const qc = useQueryClient()

  const pendingApps = useMemo(
    () => applications.filter((a) => a.status === 'pending' || a.status === 'under_review'),
    [applications],
  )
  const historyApps = useMemo(
    () => applications.filter((a) => a.status !== 'pending' && a.status !== 'under_review'),
    [applications],
  )

  const persist = useCallback(
    (next: Partial<RadarSession> & Pick<RadarSession, 'step'>) => {
      const session = sessionFromCase(caseData, {
        selectedSeconds: selectedTime,
        deadlineAt: deadlineRef.current,
        ...next,
      })
      saveRadarSession(session)
    },
    [caseData, selectedTime],
  )

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finishWaiting = useCallback(() => {
    clearTimer()
    setStep('results')
    persist({ step: 'results', deadlineAt: deadlineRef.current ?? Date.now() })
    if (!timeUpFiredRef.current) {
      timeUpFiredRef.current = true
      onTimeUp?.()
    }
  }, [clearTimer, onTimeUp, persist])

  const tickFromDeadline = useCallback(() => {
    const deadline = deadlineRef.current
    if (deadline === null) {
      // ∞
      return
    }
    if (deadline == null) return
    const remaining = computeRemainingSeconds(deadline)
    setTimeLeft(remaining)
    if (remaining <= 0) finishWaiting()
  }, [finishWaiting])

  // Restaurar / arrancar ticker basado en deadline absoluto (sobrevive remounts).
  useEffect(() => {
    if (!open) return

    const existing = loadRadarSession()
    if (existing?.caseId === caseData.id && existing.step === 'waiting') {
      deadlineRef.current = existing.deadlineAt
      startedRef.current = true
      setStep('waiting')
      if (existing.deadlineAt === null) {
        setTimeLeft(Number.POSITIVE_INFINITY)
      } else {
        const remaining = computeRemainingSeconds(existing.deadlineAt)
        if (remaining <= 0) {
          finishWaiting()
          return
        }
        setTimeLeft(remaining)
        clearTimer()
        timerRef.current = setInterval(tickFromDeadline, 1000)
      }
    }

    return () => {
      clearTimer()
    }
  }, [open, caseData.id, clearTimer, finishWaiting, tickFromDeadline])

  // Al cerrar el modal (usuario), limpiar sesión. No limpiar solo por remount.
  useEffect(() => {
    if (open) return
    clearTimer()
    // Si el padre cerró explícitamente, limpiamos. Si fue un flicker de unmount
    // con open aún true, este effect no corre.
  }, [open, clearTimer])

  const handleClose = () => {
    clearTimer()
    startedRef.current = false
    timeUpFiredRef.current = false
    deadlineRef.current = undefined
    setStep('select-time')
    setApiError(null)
    saveRadarSession(null)
    onClose()
  }

  const startWaiting = () => {
    if (startedRef.current || openingCall) return
    setApiError(null)
    setOpeningCall(true)

    // Primero abrir convocatoria; el timer SOLO arranca si tiene éxito.
    openForApps.mutate(
      { caseId: caseData.id, actorId, comment: 'Convocatoria abierta — solicitando apoyo voluntario' },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
          qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.caseEvents] })
          qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })

          startedRef.current = true
          timeUpFiredRef.current = false
          setOpeningCall(false)
          setStep('waiting')

          if (selectedTime === Infinity) {
            deadlineRef.current = null
            setTimeLeft(Number.POSITIVE_INFINITY)
            persist({ step: 'waiting', deadlineAt: null, selectedSeconds: Infinity })
            return
          }

          const deadline = Date.now() + selectedTime * 1000
          deadlineRef.current = deadline
          setTimeLeft(selectedTime)
          persist({ step: 'waiting', deadlineAt: deadline, selectedSeconds: selectedTime })
          clearTimer()
          timerRef.current = setInterval(tickFromDeadline, 1000)
        },
        onError: (err) => {
          setOpeningCall(false)
          startedRef.current = false
          setApiError(`Error al abrir la convocatoria: ${err.message}`)
          setStep('select-time')
          saveRadarSession(null)
        },
      },
    )
  }

  const stopWaiting = () => {
    // Detener espera manualmente → resultados. La convocatoria sigue abierta en BD.
    finishWaiting()
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
            <h2 className="text-sm font-semibold text-ink">Radar de cobertura</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1.5 text-ink-faint hover:bg-white/[0.06] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <GlassCard className="p-3">
            <p className="text-sm font-medium text-ink">{caseData.title}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
              <MapPin className="h-3 w-3" />
              <span>{caseData.zone}</span>
              <span className="text-ink-faint">&middot;</span>
              <Clock className="h-3 w-3" />
              <span>
                {label(
                  { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' },
                  caseData.priority,
                )}
              </span>
            </div>
          </GlassCard>

          {step === 'select-time' && (
            <div className="space-y-4">
              <p className="text-xs text-ink-muted text-center">
                ¿Cuánto tiempo permanecerá abierto el radar?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setSelectedTime(opt.value)}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-center transition-all',
                      selectedTime === opt.value
                        ? 'border-info/50 bg-info/15 text-info'
                        : 'border-white/[0.08] text-ink-subtle hover:bg-white/[0.04]',
                    )}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                  </button>
                ))}
              </div>
              {apiError && (
                <p className="text-xs text-critical bg-critical/10 rounded-lg px-3 py-2">{apiError}</p>
              )}
              <EmergencyButton className="w-full" onClick={startWaiting} disabled={openingCall}>
                {openingCall ? 'Abriendo convocatoria…' : 'Iniciar radar'}
              </EmergencyButton>
            </div>
          )}

          {step === 'waiting' && (
            <div className="space-y-5">
              <div className="relative flex items-center justify-center py-8">
                <div className="absolute h-48 w-48 rounded-full border border-info/10" />
                <div className="absolute h-36 w-36 rounded-full border border-info/15" />
                <div className="absolute h-24 w-24 rounded-full border border-info/20" />
                <div className="absolute h-12 w-12 rounded-full border border-info/30" />
                <div className="absolute h-48 w-48 animate-spin" style={{ animationDuration: '3s' }}>
                  <div
                    className="mx-auto h-24 w-0.5 origin-bottom bg-gradient-to-t from-transparent via-info/60 to-info"
                    style={{ transform: 'rotate(0deg)' }}
                  />
                </div>
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-info/20 ring-2 ring-info/30">
                  <Users className="h-7 w-7 text-info" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums text-ink">{formatTime(timeLeft)}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {pendingApps.length === 0
                    ? 'Radar activo — esperando postulantes…'
                    : `${pendingApps.length} postulante${pendingApps.length === 1 ? '' : 's'} recibido${pendingApps.length === 1 ? '' : 's'}`}
                </p>
              </div>

              {pendingApps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    Postulaciones recibidas ({pendingApps.length})
                  </p>
                  {pendingApps.map((app) => (
                    <ApplicantCard
                      key={app.id}
                      app={app}
                      actorId={actorId}
                      approveApp={approveApp}
                      rejectApp={rejectApp}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {selectedTime !== Infinity && (
                  <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={stopWaiting}>
                    Detener espera
                  </EmergencyButton>
                )}
                <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={handleClose}>
                  Cerrar
                </EmergencyButton>
              </div>
            </div>
          )}

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
                    ? 'Revisa y aprueba a los postulantes. La convocatoria sigue abierta hasta que apruebes o cierres.'
                    : 'Nadie se postuló en este tiempo. Puedes reabrir el radar o asignar por inventario.'}
                </p>
              </div>

              {pendingApps.length === 0 && (
                <div className="flex gap-2">
                  <EmergencyButton
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      startedRef.current = false
                      timeUpFiredRef.current = false
                      deadlineRef.current = undefined
                      setStep('select-time')
                      saveRadarSession(null)
                    }}
                  >
                    Reabrir radar
                  </EmergencyButton>
                  <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={handleClose}>
                    Cerrar
                  </EmergencyButton>
                </div>
              )}

              {pendingApps.map((app) => (
                <ApplicantCard
                  key={app.id}
                  app={app}
                  actorId={actorId}
                  approveApp={approveApp}
                  rejectApp={rejectApp}
                  showTrust
                />
              ))}

              {historyApps.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Historial</p>
                  {historyApps.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2"
                    >
                      <p className="text-xs text-ink">{app.applicantName}</p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          app.status === 'approved'
                            ? 'bg-operational/15 text-operational'
                            : 'bg-critical/15 text-critical',
                        )}
                      >
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

function ApplicantCard({
  app,
  actorId,
  approveApp,
  rejectApp,
  showTrust,
}: {
  app: {
    id: string
    applicantName: string
    organization?: string
    message?: string
    skills?: string[]
    distanceKm?: number
    trustScore?: number
  }
  actorId?: string
  approveApp: ReturnType<typeof useApproveCaseApplication>
  rejectApp: ReturnType<typeof useRejectCaseApplication>
  showTrust?: boolean
}) {
  return (
    <GlassCard className="border-info/20 bg-info/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{app.applicantName}</p>
          <p className="text-[11px] text-info">
            {app.distanceKm != null
              ? app.distanceKm < 1
                ? `a ${Math.round(app.distanceKm * 1000)} m del reporte`
                : `a ${app.distanceKm.toFixed(1)} km del reporte`
              : 'Rango no disponible'}
          </p>
          {app.organization && <p className="text-xs text-ink-subtle">{app.organization}</p>}
          {showTrust && app.trustScore !== undefined && (
            <p className="text-[10px] text-ink-faint mt-0.5">Confianza: {app.trustScore}%</p>
          )}
        </div>
        <span className="shrink-0 animate-pulse rounded-full bg-operational/20 px-2 py-0.5 text-[10px] font-medium text-operational">
          Nuevo
        </span>
      </div>
      {app.message && <p className="mt-1 text-xs text-ink-muted">{app.message}</p>}
      {app.skills && app.skills.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {app.skills.map((s) => (
            <span
              key={s}
              className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-faint"
            >
              {label(SKILL_LABELS, s, s)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => approveApp.mutate({ applicationId: app.id, operatorId: actorId ?? '' })}
          disabled={approveApp.isPending || !actorId}
          className="flex-1 rounded-lg bg-operational/15 py-1.5 text-xs font-medium text-operational hover:bg-operational/25"
        >
          Aprobar
        </button>
        <button
          type="button"
          onClick={() => rejectApp.mutate({ applicationId: app.id, operatorId: actorId ?? '' })}
          disabled={rejectApp.isPending || !actorId}
          className="flex-1 rounded-lg bg-critical/15 py-1.5 text-xs font-medium text-critical hover:bg-critical/25"
        >
          Rechazar
        </button>
      </div>
    </GlassCard>
  )
}
