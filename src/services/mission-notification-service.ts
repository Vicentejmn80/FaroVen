import { supabase } from '@/lib/supabase'

export interface MissionNotificationChannel {
  send(recipientId: string, title: string, message: string, data?: Record<string, unknown>): Promise<void>
}

class LogChannel implements MissionNotificationChannel {
  async send(_recipientId: string, title: string, _message: string) {
    console.log(`[MISSION NOTIFICATION] ${title}`)
  }
}

class DatabaseNotificationChannel implements MissionNotificationChannel {
  async send(recipientId: string, title: string, message: string, data?: Record<string, unknown>) {
    try {
      await supabase.rpc('create_notification', {
        p_user_id: recipientId,
        p_title: title,
        p_message: message,
        p_type: 'mission',
        p_priority: 'normal',
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

export interface MissionNotificationEvent {
  volunteerId: string
  volunteerName: string
  missionId: string
  missionTitle: string
  event: string
}

export async function notifyVolunteer(event: MissionNotificationEvent): Promise<void> {
  const messages: Record<string, { title: string; message: string }> = {
    volunteer_assigned: {
      title: 'Nueva misión asignada',
      message: `Has sido asignado a la misión: ${event.missionTitle}`,
    },
    volunteer_en_route: {
      title: 'Confirmación de ruta',
      message: `Tu ruta hacia la misión "${event.missionTitle}" ha sido registrada`,
    },
    mission_cancelled: {
      title: 'Misión cancelada',
      message: `La misión "${event.missionTitle}" ha sido cancelada`,
    },
    mission_completed: {
      title: 'Misión completada',
      message: `La misión "${event.missionTitle}" ha sido marcada como completada`,
    },
  }

  const template = messages[event.event]
  if (!template) return

  for (const channel of missionNotificationChannels) {
    await channel.send(event.volunteerId, template.title, template.message, {
      missionId: event.missionId,
      event: event.event,
    })
  }
}

export async function notifyCoordinator(event: {
  coordinatorId: string
  missionTitle: string
  event: string
  detail?: string
}): Promise<void> {
  const messages: Record<string, string> = {
    volunteer_accepted: `Voluntario aceptó la misión "${event.missionTitle}"`,
    volunteer_rejected: `Voluntario rechazó la misión "${event.missionTitle}"`,
    volunteer_on_site: `Voluntario llegó al sitio de la misión "${event.missionTitle}"`,
    mission_completed: `Misión "${event.missionTitle}" completada — pendiente de verificación`,
  }

  const message = messages[event.event]
  if (!message) return

  for (const channel of missionNotificationChannels) {
    await channel.send(event.coordinatorId, 'Actualización de misión', message, {
      event: event.event,
      detail: event.detail,
    })
  }
}
