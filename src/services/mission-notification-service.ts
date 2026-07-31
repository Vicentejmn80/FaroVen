import { supabase } from '@/lib/supabase'
import { volunteerRepository } from '@/repositories/volunteer-repository'

export interface MissionNotificationChannel {
  send(
    recipientId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    priority?: NotificationPriority,
    actionUrl?: string,
  ): Promise<void>
}

type NotificationPriority = 'critical' | 'high' | 'normal' | 'low'

class LogChannel implements MissionNotificationChannel {
  async send(_recipientId: string, title: string) {
    console.log(`[MISSION NOTIFICATION] ${title}`)
  }
}

class DatabaseNotificationChannel implements MissionNotificationChannel {
  async send(
    recipientId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    priority: NotificationPriority = 'normal',
    actionUrl?: string,
  ) {
    try {
      await supabase.rpc('create_notification', {
        p_user_id: recipientId,
        p_title: title,
        p_message: message,
        p_type: 'mission',
        p_priority: priority,
        p_action_url: actionUrl ?? null,
        p_metadata: (data ?? {}) as Record<string, unknown>,
      })
    } catch {
      console.warn('[NOTIFICATION] Failed to send DB notification:', title)
    }
  }
}

export const missionNotificationChannels: MissionNotificationChannel[] = [
  new DatabaseNotificationChannel(),
  new LogChannel(),
]

/** Cada transición del motor de ejecución tiene un aviso asociado. */
export type MissionNoticeEvent =
  | 'volunteer_assigned'
  | 'volunteer_accepted'
  | 'volunteer_rejected'
  | 'volunteer_preparing'
  | 'volunteer_en_route'
  | 'volunteer_on_site'
  | 'mission_in_progress'
  | 'evidence_submitted'
  | 'mission_completed'
  | 'mission_verified'
  | 'mission_cancelled'
  | 'application_submitted'
  | 'success_case_created'

interface NoticeTemplate {
  title: string
  message: (missionTitle: string, actorName?: string) => string
  priority?: NotificationPriority
}

/** Avisos dirigidos al voluntario que ejecuta la misión. */
const VOLUNTEER_NOTICES: Partial<Record<MissionNoticeEvent, NoticeTemplate>> = {
  volunteer_assigned: {
    title: 'Tu postulación fue aceptada',
    message: (t) => `Fuiste asignado a "${t}". Abre la misión para comenzar.`,
    priority: 'high',
  },
  volunteer_rejected: {
    title: 'Misión liberada',
    message: (t) => `Ya no estás asignado a "${t}".`,
  },
  volunteer_en_route: {
    title: 'Misión iniciada',
    message: (t) => `Registramos que vas en camino a "${t}".`,
  },
  volunteer_on_site: {
    title: 'Llegada registrada',
    message: (t) => `Confirmamos tu llegada al punto de "${t}".`,
  },
  mission_completed: {
    title: 'Ayuda finalizada',
    message: (t) => `Enviamos "${t}" al gestor para su validación.`,
  },
  mission_verified: {
    title: 'Ayuda validada',
    message: (t) => `El gestor validó tu trabajo en "${t}". ¡Gracias!`,
    priority: 'high',
  },
  mission_cancelled: {
    title: 'Misión cancelada',
    message: (t) => `La misión "${t}" fue cancelada.`,
    priority: 'high',
  },
  success_case_created: {
    title: 'Caso de éxito registrado',
    message: (t) => `"${t}" quedó registrada como caso de éxito.`,
  },
}

/** Avisos dirigidos a gestores y coordinadores que supervisan la operación. */
const OPERATOR_NOTICES: Partial<Record<MissionNoticeEvent, NoticeTemplate>> = {
  application_submitted: {
    title: 'Nuevo voluntario postuló',
    message: (t, name) => `${name ?? 'Un voluntario'} se postuló a "${t}".`,
    priority: 'high',
  },
  volunteer_accepted: {
    title: 'Voluntario confirmó la misión',
    message: (t, name) => `${name ?? 'El voluntario'} aceptó "${t}".`,
  },
  volunteer_rejected: {
    title: 'Voluntario rechazó la misión',
    message: (t, name) => `${name ?? 'El voluntario'} rechazó "${t}". Busca otro apoyo.`,
    priority: 'high',
  },
  volunteer_preparing: {
    title: 'Voluntario preparándose',
    message: (t, name) => `${name ?? 'El voluntario'} está alistando materiales para "${t}".`,
    priority: 'low',
  },
  volunteer_en_route: {
    title: 'Voluntario inició misión',
    message: (t, name) => `${name ?? 'El voluntario'} va en camino a "${t}".`,
  },
  volunteer_on_site: {
    title: 'Voluntario llegó al lugar',
    message: (t, name) => `${name ?? 'El voluntario'} llegó al punto de "${t}".`,
    priority: 'high',
  },
  mission_in_progress: {
    title: 'Voluntario inició traslado / ayuda',
    message: (t, name) => `${name ?? 'El voluntario'} está ejecutando "${t}".`,
  },
  evidence_submitted: {
    title: 'Evidencia recibida',
    message: (t, name) => `${name ?? 'El voluntario'} adjuntó evidencia de "${t}".`,
  },
  mission_completed: {
    title: 'GC pendiente de verificar entrega',
    message: (t, name) => `${name ?? 'El voluntario'} finalizó "${t}". Revisa la evidencia y cierra el caso.`,
    priority: 'high',
  },
  mission_verified: {
    title: 'Caso listo para cerrar — validado',
    message: (t) => `"${t}" fue validada. El caso puede archivarse.`,
  },
  mission_cancelled: {
    title: 'Misión cancelada',
    message: (t) => `La misión "${t}" fue cancelada. Revisa si necesitas reabrir apoyo.`,
    priority: 'high',
  },
  success_case_created: {
    title: 'Caso convertido en éxito',
    message: (t) => `"${t}" se sumó a la biblioteca de casos de éxito.`,
  },
}

export interface MissionNotificationEvent {
  /** `volunteers.id` del ejecutor de la misión. */
  volunteerId: string
  volunteerName?: string
  missionId: string
  missionTitle: string
  event: MissionNoticeEvent
  caseId?: string | null
}

async function dispatch(
  recipientId: string,
  template: NoticeTemplate,
  missionTitle: string,
  actorName: string | undefined,
  metadata: Record<string, unknown>,
  actionUrl?: string,
) {
  for (const channel of missionNotificationChannels) {
    await channel.send(
      recipientId,
      template.title,
      template.message(missionTitle, actorName),
      metadata,
      template.priority ?? 'normal',
      actionUrl,
    )
  }
}

/**
 * Avisa al voluntario asignado.
 *
 * Recibe un `volunteers.id`, pero `create_notification` espera el id de
 * `auth.users`: sin esta traducción el aviso se descartaba en silencio.
 */
export async function notifyVolunteer(event: MissionNotificationEvent): Promise<void> {
  const template = VOLUNTEER_NOTICES[event.event]
  if (!template) return

  const identity = await volunteerRepository.findIdentity(event.volunteerId)
  if (!identity) return

  const actionUrl =
    event.event === 'mission_cancelled'
      ? 'tab:volunteer:available'
      : `tab:map:mission-assigned:${event.missionId}`

  await dispatch(
    identity.userId,
    template,
    event.missionTitle,
    event.volunteerName,
    {
      missionId: event.missionId,
      caseId: event.caseId ?? null,
      event: event.event,
    },
    actionUrl,
  )
}

function operatorActionUrl(event: MissionNoticeEvent, caseId?: string | null): string {
  if (caseId) {
    if (event === 'mission_completed' || event === 'evidence_submitted' || event === 'mission_verified') {
      return `tab:case-manager:case:${caseId}`
    }
    return `tab:case-manager:case:${caseId}`
  }
  return 'tab:case-manager'
}

/** Avisa a gestores y coordinadores del avance de la misión. */
export async function notifyMissionOperators(event: {
  missionId: string
  missionTitle: string
  volunteerName?: string
  event: MissionNoticeEvent
  excludeUserId?: string
  caseId?: string | null
}): Promise<void> {
  const template = OPERATOR_NOTICES[event.event]
  if (!template) return

  const actionUrl = operatorActionUrl(event.event, event.caseId)
  const operators = await listOperationalUsers()
  for (const operatorId of operators) {
    if (operatorId === event.excludeUserId) continue
    await dispatch(
      operatorId,
      template,
      event.missionTitle,
      event.volunteerName,
      { missionId: event.missionId, caseId: event.caseId ?? null, event: event.event },
      actionUrl,
    )
  }
}

async function listOperationalUsers(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['case_manager', 'coordinator', 'regional_admin', 'super_admin'])
      .eq('status', 'active')
    return ((data ?? []) as { id: string }[]).map((row) => row.id)
  } catch {
    return []
  }
}
