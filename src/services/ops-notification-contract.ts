import { notifyUser } from '@/lib/notify'
import { operationalLog } from '@/lib/operational-log'

/** Tipos estables de handoffs operativos GC / Centro / Voluntario. */
export type OpsNotificationType =
  | 'report_received'
  | 'citizen_report'
  | 'case_application'
  | 'coverage_interest_submitted'
  | 'center_assignment'
  | 'center_accepted_request'
  | 'center_needs_volunteer'
  | 'center_rejected'
  | 'need_call_opened'
  | 'radar_opened'
  | 'case_open'
  | 'case_approved'
  | 'case_rejected'
  | 'logistics_preparation'
  | 'resources_ready'
  | 'resources_delivered'
  | 'mission_center_update'
  | 'mission_completed_pending_verify'
  | 'mission'
  | 'system'

export type OpsNotifyPriority = 'critical' | 'high' | 'normal' | 'low'

/** Catálogo de action_url canónicos para deep-links de campana. */
export const OPS_ACTION_URLS = {
  gcBandeja: () => 'tab:case-manager',
  gcCase: (caseId: string) => `tab:case-manager:case:${caseId}`,
  gcApplication: (caseId: string, applicationId: string) =>
    `tab:case-manager:application:${caseId}:${applicationId}`,
  coordinatorNeeds: () => 'tab:ops:needs',
  coordinatorMissions: () => 'tab:ops:missions',
  volunteerMap: () => 'tab:map',
  volunteerAvailable: () => 'tab:volunteer:available',
  volunteerMissions: () => 'tab:volunteer:my-missions',
  volunteerMissionAssigned: (missionId: string) => `tab:map:mission-assigned:${missionId}`,
} as const

export interface OpsNotifyInput {
  to: string
  type: OpsNotificationType | string
  title: string
  message: string
  actionUrl?: string | null
  priority?: OpsNotifyPriority
  icon?: string | null
  metadata?: Record<string, unknown>
  /** Para log FARO_OPS */
  entityType?: 'case' | 'mission' | 'assignment' | 'application' | 'report' | 'public_need' | 'reservation'
  entityId?: string
  caseId?: string | null
  missionId?: string | null
  actorId?: string | null
}

/**
 * Wrapper de notifyUser con log `[FARO_OPS]` en cada handoff.
 * Nunca lanza: un fallo de notificación no tumba la transición operativa.
 */
export async function opsNotify(input: OpsNotifyInput): Promise<void> {
  const {
    to,
    type,
    title,
    message,
    actionUrl,
    priority = 'normal',
    icon,
    metadata,
    entityType = 'case',
    entityId,
    caseId,
    missionId,
    actorId,
  } = input

  try {
    await notifyUser(to, title, message, type, metadata, {
      priority,
      actionUrl: actionUrl ?? null,
      icon: icon ?? null,
    })
    operationalLog({
      entityType,
      entityId: entityId ?? caseId ?? missionId ?? to,
      action: 'ops_notify',
      actorId: actorId ?? null,
      caseId: caseId ?? (typeof metadata?.caseId === 'string' ? metadata.caseId : null),
      missionId: missionId ?? (typeof metadata?.missionId === 'string' ? metadata.missionId : null),
      source: 'service',
      payload: {
        type,
        toUserId: to,
        actionUrl: actionUrl ?? null,
        title,
      },
    })
  } catch (err) {
    operationalLog({
      entityType,
      entityId: entityId ?? caseId ?? missionId ?? to,
      action: 'ops_notify',
      actorId: actorId ?? null,
      caseId: caseId ?? null,
      missionId: missionId ?? null,
      source: 'service',
      error: err instanceof Error ? err.message : String(err),
      payload: { type, toUserId: to, title },
    })
  }
}
