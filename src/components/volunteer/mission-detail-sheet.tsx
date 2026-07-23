import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  MapPin,
  Navigation,
  Share2,
  Users,
  X,
  Route,
  Sparkles,
  History,
} from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { useAuth } from '@/store/auth-context'
import { useExpressInterest } from '@/hooks/useVolunteerInterests'
import { openExternalNavigation, buildGoogleMapsViewLink, cn, timeAgo, isValidCoord } from '@/lib/utils'
import {
  label,
  MISSION_PRIORITY_LABELS,
  PRIORITY_SHORT_LABELS,
  INCIDENT_TYPE_LABELS,
  INTEREST_STATUS_LABELS,
  MAP_MISSION_STATUS_LABELS,
  OP_LABELS,
} from '@/lib/labels'

export interface VolunteerMissionDetail {
  id: string
  title: string
  requiredSkill?: string | null
  status: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  location: { lat: number; lng: number }
  createdAt: Date
  siteName: string
  zone: string
  distanceKm: string
  description?: string
  affectedPeople?: number | null
  expiresAt?: Date | null
  required?: number | null
  available?: number | null
}

type HelpPhase = 'idle' | 'confirming' | 'submitted' | 'error'

interface MissionDetailSheetProps {
  mission: VolunteerMissionDetail | null
  onClose: () => void
  variant?: 'sheet' | 'panel'
}

const PORTAL_ID = 'faro-portals'

function getPortalRoot() {
  return document.getElementById(PORTAL_ID) ?? document.body
}

function humanizeNeedTitle(raw: string): string {
  const key = raw.trim().toLowerCase()
  return label(INCIDENT_TYPE_LABELS, key, raw)
}

function priorityTone(priority: string): string {
  if (priority === 'critical') return 'bg-critical/20 text-critical'
  if (priority === 'high') return 'bg-warning/20 text-warning'
  if (priority === 'medium') return 'bg-info/20 text-info'
  return 'bg-operational/20 text-operational'
}

function remainingLabel(expiresAt?: Date | null): string | null {
  if (!expiresAt) return null
  const ms = expiresAt.getTime() - Date.now()
  if (ms <= 0) return 'Vencida'
  const hours = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hours >= 1) return `Quedan ${hours} h ${mins} min`
  return `Quedan ${mins} min`
}

function etaFromDistance(distanceKm: string): string {
  const km = Number.parseFloat(distanceKm)
  if (!Number.isFinite(km)) return 'Tiempo estimado no disponible'
  const minutes = Math.max(8, Math.round(km * 4.5))
  if (minutes < 60) return `≈ ${minutes} min en llegar`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `≈ ${h} h ${m} min en llegar`
}

function similarityConfidence(scoreHint?: number): string {
  if (scoreHint == null) return 'Confianza media'
  if (scoreHint >= 80) return 'Confianza alta'
  if (scoreHint >= 50) return 'Confianza media'
  return 'Confianza baja'
}

/**
 * Detalle operacional de una misión/necesidad para voluntarios.
 * Bottom sheet en móvil · panel lateral en desktop.
 */
export function MissionDetailSheet({
  mission,
  onClose,
  variant = 'sheet',
}: MissionDetailSheetProps) {
  const { profile, user } = useAuth()
  const expressInterest = useExpressInterest()
  const [phase, setPhase] = useState<HelpPhase>('idle')
  const [helpError, setHelpError] = useState<string | null>(null)

  useEffect(() => {
    setPhase('idle')
    setHelpError(null)
  }, [mission?.id])

  const handleReportProblem = useCallback(() => {
    window.dispatchEvent(new CustomEvent('faro:open-help-center'))
  }, [])

  const title = mission ? humanizeNeedTitle(mission.title) : ''
  const remaining = remainingLabel(mission?.expiresAt ?? null)
  const eta = mission ? etaFromDistance(mission.distanceKm) : ''
  const shortage =
    mission?.required != null && mission?.available != null
      ? Math.max(0, mission.required - mission.available)
      : null

  const timeline = useMemo(() => {
    if (!mission) return []
    return [
      {
        id: 'published',
        label: 'Publicada',
        detail: timeAgo(mission.createdAt),
        done: true,
      },
      {
        id: 'open',
        label: 'Buscando apoyo',
        detail: 'Visible para voluntarios cercanos',
        done: true,
      },
      {
        id: 'interest',
        label: phase === 'submitted' ? 'Tu interés registrado' : 'Esperando voluntarios',
        detail:
          phase === 'submitted'
            ? 'Un gestor revisará tu postulación'
            : 'Aún sin ayuda confirmada',
        done: phase === 'submitted',
      },
      {
        id: 'support',
        label: 'Ayuda en proceso',
        detail: 'Se activa al confirmar el gestor',
        done: false,
      },
    ]
  }, [mission, phase])

  const handleHelp = useCallback(async () => {
    if (!mission) return
    setPhase('confirming')
    setHelpError(null)
    try {
      const volunteerId = user?.id ?? profile?.id
      if (!volunteerId) throw new Error('Debes iniciar sesión para ofrecer ayuda.')
      await expressInterest.mutateAsync({
        volunteerId,
        volunteerName: profile?.full_name ?? 'Voluntario',
        message: `Quiero ayudar con: ${title}`,
        needId: mission.id,
      })
      setPhase('submitted')
    } catch (err) {
      setPhase('error')
      setHelpError(err instanceof Error ? err.message : 'No se pudo registrar tu interés.')
    }
  }, [mission, expressInterest, user?.id, profile?.id, profile?.full_name, title])

  const handleNavigate = useCallback(() => {
    if (!mission) return
    if (!isValidCoord(mission.location.lat, mission.location.lng)) {
      console.warn('[FARO] Mission missing latitude. Skipping navigation.', { missionId: mission.id })
      setHelpError('Esta misión aún no posee una ubicación precisa.')
      setPhase('error')
      return
    }
    openExternalNavigation({
      lat: mission.location.lat,
      lng: mission.location.lng,
      name: mission.siteName,
      address: mission.zone,
    })
  }, [mission])

  const handleShare = useCallback(async () => {
    if (!mission) return
    const maps = isValidCoord(mission.location.lat, mission.location.lng)
      ? buildGoogleMapsViewLink(mission.location.lat, mission.location.lng, title)
      : null
    const text = `${title} · ${mission.siteName} (${mission.zone}). ${mission.distanceKm} km. Ayuda con FARO.`
    const url = maps ?? window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
    } catch {
      // usuario canceló compartir
    }
  }, [mission, title])

  if (variant === 'panel' && !mission) return null

  const body = mission ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-3 pb-2">
        {variant === 'sheet' && (
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', priorityTone(mission.priority))}>
                {label(PRIORITY_SHORT_LABELS, mission.priority, label(MISSION_PRIORITY_LABELS, mission.priority))}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-ink-muted">
                {label(MAP_MISSION_STATUS_LABELS, mission.status, 'En curso')}
              </span>
            </div>
            <h2 className="mt-2 text-[17px] font-semibold leading-snug text-ink">
              <NeedItemLabel name={title} />
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-subtle">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {mission.siteName} · {mission.zone}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-subtle hover:bg-white/10 hover:text-ink"
            aria-label={OP_LABELS.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <MetricChip icon={Route} label="Distancia" value={`${mission.distanceKm} km`} />
          <MetricChip icon={Clock} label="Llegada" value={eta.replace('≈ ', '')} />
          {remaining && <MetricChip icon={Flag} label="Vigencia" value={remaining} />}
          {mission.affectedPeople != null && (
            <MetricChip icon={Users} label="Personas" value={`${mission.affectedPeople}`} />
          )}
          {shortage != null && shortage > 0 && (
            <MetricChip icon={Sparkles} label="Falta cubrir" value={`${shortage} uds.`} />
          )}
        </div>

        <GlassCard inset={false} className="space-y-2 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Qué se necesita
          </p>
          <p className="text-sm leading-relaxed text-ink">
            {mission.description?.trim() ||
              `Se requiere apoyo con ${title.toLowerCase()} en ${mission.zone}.`}
          </p>
          {mission.requiredSkill && (
            <p className="text-xs text-ink-muted">
              Perfil sugerido: {humanizeNeedTitle(mission.requiredSkill)}
            </p>
          )}
        </GlassCard>

        <GlassCard inset={false} className="space-y-2 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Ubicación aproximada
          </p>
          <p className="text-sm text-ink">{mission.zone}</p>
          <p className="text-xs text-ink-muted">
            Centro relacionado: {mission.siteName}
          </p>
          <p className="text-xs text-ink-faint">
            Publicada {timeAgo(mission.createdAt)} · {similarityConfidence(72)}
          </p>
        </GlassCard>

        <GlassCard inset={false} className="space-y-3 p-3.5">
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-info" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Seguimiento
            </p>
          </div>
          <ol className="space-y-2.5">
            {timeline.map((item, idx) => (
              <li key={item.id} className="flex gap-3">
                <span className="relative mt-1 flex flex-col items-center">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      item.done ? 'bg-info shadow-[0_0_0_3px_rgba(10,132,255,0.25)]' : 'bg-white/20',
                    )}
                  />
                  {idx < timeline.length - 1 && (
                    <span className="mt-1 h-full min-h-[14px] w-px bg-white/10" />
                  )}
                </span>
                <div className="min-w-0 flex-1 pb-1">
                  <p className={cn('text-sm font-medium', item.done ? 'text-ink' : 'text-ink-muted')}>
                    {item.label}
                  </p>
                  <p className="text-xs text-ink-subtle">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </GlassCard>

        <GlassCard inset={false} className="space-y-2 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Recomendaciones
          </p>
          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-muted">
            <li>· Confirma tu disponibilidad real antes de postularte.</li>
            <li>· Lleva identificación y sigue las indicaciones del gestor.</li>
            <li>· Si la situación cambia, reporta el problema desde este panel.</li>
          </ul>
        </GlassCard>

        {phase === 'submitted' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-operational/30 bg-operational/10 p-3.5"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-operational" />
              <div>
                <p className="text-sm font-semibold text-ink">Interés registrado</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Estado: {label(INTEREST_STATUS_LABELS, 'pending')}. Un gestor te contactará
                  si tu apoyo es aceptado.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'error' && helpError && (
          <div className="rounded-2xl border border-critical/30 bg-critical/10 p-3.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
              <p className="text-xs text-critical">{helpError}</p>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/[0.06] bg-base-900/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2">
          {phase === 'submitted' ? (
            <EmergencyButton variant="glass" size="md" className="w-full" onClick={onClose}>
              Ver seguimiento
            </EmergencyButton>
          ) : (
            <EmergencyButton
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleHelp}
              disabled={phase === 'confirming' || expressInterest.isPending}
            >
              {phase === 'confirming' ? 'Registrando…' : OP_LABELS.offer}
            </EmergencyButton>
          )}
          <EmergencyButton variant="glass" size="md" className="w-full" onClick={handleNavigate}>
            <span className="inline-flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5" />
              Ver ruta
            </span>
          </EmergencyButton>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <EmergencyButton variant="glass" size="sm" className="w-full" onClick={handleShare}>
            <span className="inline-flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              {OP_LABELS.share}
            </span>
          </EmergencyButton>
          <EmergencyButton variant="glass" size="sm" className="w-full" onClick={handleReportProblem}>
            Reportar problema
          </EmergencyButton>
        </div>
      </div>
    </div>
  ) : null

  if (variant === 'panel') {
    return (
      <aside
        className="glass-strong flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-white/10"
        role="dialog"
        aria-label={`Detalle de ${title}`}
      >
        {body}
      </aside>
    )
  }

  return createPortal(
    <AnimatePresence>
      {mission && body ? (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar detalle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[1px] lg:hidden"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${title}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0b1424]/96 shadow-2xl backdrop-blur-2xl lg:hidden"
          >
            {body}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    getPortalRoot(),
  )
}

function MetricChip({
  icon: Icon,
  label: chipLabel,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-faint">
        <Icon className="h-3 w-3" />
        {chipLabel}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}
