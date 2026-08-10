import { cn } from '@/lib/utils'
import { MISSION_EVENT_LABELS, label } from '@/lib/labels'
import type { CaseDomainEvent } from '@/domain/case-lifecycle.types'
import type { MissionEvent } from '@/domain/mission.types'

export interface AuditTimelineItem {
  id: string
  at: Date
  title: string
  detail?: string
  icon: string
  source: 'mission' | 'case' | 'application'
}

const CASE_EVENT_HUMAN: Record<string, { title: string; icon: string }> = {
  case_submitted: { title: 'Reporte recibido', icon: '📥' },
  case_review_started: { title: 'Caso creado', icon: '✅' },
  case_validated: { title: 'Caso validado', icon: '✅' },
  case_info_requested: { title: 'Se pidió más información', icon: '💬' },
  case_info_received: { title: 'Información recibida', icon: '💬' },
  case_opened_for_applications: { title: 'Necesidad publicada', icon: '📢' },
  case_awaiting_center: { title: 'Centro propuesto', icon: '🏥' },
  case_center_confirmed: { title: 'Centro confirmó', icon: '✅' },
  case_assigned: { title: 'Postulación aceptada', icon: '✔️' },
  case_accepted: { title: 'Voluntario aceptó la misión', icon: '✅' },
  case_attention_started: { title: 'Atención en curso', icon: '⚡' },
  case_resolved: { title: 'Caso validado y cerrado', icon: '✅' },
  case_reopened: { title: 'Caso reabierto', icon: '↺' },
  case_closed: { title: 'Archivado en historial', icon: '📦' },
  case_dismissed: { title: 'Caso descartado', icon: '✕' },
}

const MISSION_EVENT_ICON: Record<string, string> = {
  application_submitted: '🙋',
  application_approved: '✔️',
  application_rejected: '✕',
  volunteer_assigned: '✔️',
  volunteer_accepted: '✅',
  volunteer_preparing: '🧰',
  volunteer_en_route: '🚗',
  volunteer_on_site: '📍',
  mission_in_progress: '🤝',
  evidence_submitted: '📷',
  mission_completed: '✅',
  mission_verified: '✅',
  eta_delay: '⏱️',
  delivery_partial: '📦',
  awaiting_validation: '✅',
}

/** Une eventos de misión y caso en una auditoría humana tipo Uber. */
export function buildAuditTimeline(input: {
  caseEvents?: CaseDomainEvent[]
  missionEvents?: MissionEvent[]
}): AuditTimelineItem[] {
  const items: AuditTimelineItem[] = []

  for (const e of input.missionEvents ?? []) {
    const human = e.description?.trim()
    const fallback = label(MISSION_EVENT_LABELS, e.eventType)
    let title = human || fallback
    if (e.eventType === 'volunteer_en_route') title = 'Voluntario en camino'
    if (e.eventType === 'volunteer_on_site') title = 'Llegó al sitio'
    if (e.eventType === 'mission_completed') title = 'Entregado (esperando validación)'
    if (e.eventType === 'eta_delay') {
      title = human?.includes('retraso') ? human : `Retraso reportado${human ? `: ${human}` : ''}`
    }
    items.push({
      id: `m-${e.id}`,
      at: e.createdAt,
      title,
      detail: e.actorName,
      icon: MISSION_EVENT_ICON[e.eventType] ?? '●',
      source: 'mission',
    })
  }

  for (const e of input.caseEvents ?? []) {
    // Evitar ruido: si hay misión, omitir saltos internos duplicados con el mismo comment genérico de validación
    const meta = CASE_EVENT_HUMAN[e.eventType]
    const title = meta?.title ?? e.comment ?? e.eventType
    // Preferir comment humano si no es el placeholder de resolución en cascada
    const isCascadeNoise =
      e.comment === 'Misión validada — caso resuelto' &&
      e.eventType !== 'case_resolved'
    if (isCascadeNoise) continue

    items.push({
      id: `c-${e.id}`,
      at: e.createdAt,
      title: e.comment && !isCascadeNoise && e.eventType !== 'case_submitted'
        ? (meta?.title ?? e.comment)
        : title,
      detail: undefined,
      icon: meta?.icon ?? '●',
      source: 'case',
    })
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime())
}

export function LiveMissionAuditTimeline({
  items,
  className,
  dense,
}: {
  items: AuditTimelineItem[]
  className?: string
  dense?: boolean
}) {
  if (items.length === 0) {
    return (
      <p
        className={cn(
          'rounded-xl border border-dashed border-white/[0.08] px-3 py-4 text-center text-[11px] text-ink-muted',
          className,
        )}
      >
        Esperando actividad del caso…
      </p>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      <p className="mb-2 text-xs font-medium text-operational">Timeline en vivo</p>
      {items.map((item) => (
        <div key={item.id} className="flex gap-3">
          <div className="flex w-12 shrink-0 flex-col items-end pt-0.5">
            <span className="text-[11px] tabular-nums font-medium text-ink-muted">
              {formatClock(item.at)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-xs">
              {item.icon}
            </span>
            <div className="w-px flex-1 bg-white/[0.08]" />
          </div>
          <div className={cn('min-w-0 flex-1', dense ? 'pb-2.5' : 'pb-3.5')}>
            <p className="text-sm font-medium leading-snug text-ink">{item.title}</p>
            {item.detail && (
              <p className="mt-0.5 text-[11px] text-ink-faint">{item.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatClock(d: Date): string {
  try {
    return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
