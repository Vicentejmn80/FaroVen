type LogSource = 'ui' | 'service' | 'realtime' | 'system'

export type OpsLogChannel =
  | 'CASE'
  | 'MISSION'
  | 'RESERVATION'
  | 'CENTER'
  | 'VOLUNTEER'
  | 'INVENTORY'
  | 'TIMELINE'
  | 'REALTIME'
  | 'NOTIFICATION'

export interface OperationalLogPayload {
  entityType: 'case' | 'mission' | 'assignment' | 'application' | 'report' | 'public_need' | 'reservation'
  entityId: string
  action: string
  from?: string | null
  to?: string | null
  actorId?: string | null
  actorRole?: string | null
  volunteerId?: string | null
  centerId?: string | null
  missionId?: string | null
  caseId?: string | null
  source?: LogSource
  payload?: Record<string, unknown>
  durationMs?: number
  error?: string | null
  /** Canal canónico del centro de comando (además de FARO_OPS). */
  channel?: OpsLogChannel
}

/**
 * Log estructurado para diagnosticar el flujo operacional.
 * Emite a consola con prefijo estable; metadata lista para case_events / mission_events.
 */
export function operationalLog(entry: OperationalLogPayload): Record<string, unknown> {
  const record = {
    ts: new Date().toISOString(),
    source: entry.source ?? 'service',
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    from: entry.from ?? null,
    to: entry.to ?? null,
    actor_id: entry.actorId ?? null,
    actor_role: entry.actorRole ?? null,
    volunteer_id: entry.volunteerId ?? null,
    center_id: entry.centerId ?? null,
    mission_id: entry.missionId ?? null,
    case_id: entry.caseId ?? null,
    duration_ms: entry.durationMs ?? null,
    error: entry.error ?? null,
    payload: entry.payload ?? {},
  }

  if (entry.error) {
    console.warn('[FARO_OPS]', record)
  } else {
    console.info('[FARO_OPS]', record)
  }

  if (entry.channel) {
    const tag = `[${entry.channel}]`
    if (entry.error) console.warn(tag, record)
    else console.info(tag, record)
  }

  return record
}

/** Log con canal canónico del pipeline logístico. */
export function opsChannelLog(
  channel: OpsLogChannel,
  entry: Omit<OperationalLogPayload, 'channel'>,
): Record<string, unknown> {
  return operationalLog({ ...entry, channel })
}

export async function withOperationalLog<T>(
  entry: Omit<OperationalLogPayload, 'error' | 'durationMs'>,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now()
  try {
    const result = await fn()
    operationalLog({ ...entry, durationMs: Date.now() - started })
    return result
  } catch (err) {
    operationalLog({
      ...entry,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/** Prefijo estable `[FARO_MISSION]` para el ciclo misión/postulación. */
export function missionLog(
  action:
    | 'mission_created'
    | 'waiting_for_applications'
    | 'application_received'
    | 'application_accepted'
    | 'mission_started'
    | 'mission_eta_updated'
    | 'mission_completed'
    | 'mission_verified'
    | 'mission_closed',
  extra: Partial<OperationalLogPayload> & { entityId: string },
): Record<string, unknown> {
  const record = operationalLog({
    entityType: extra.entityType ?? 'mission',
    entityId: extra.entityId,
    action,
    from: extra.from,
    to: extra.to,
    actorId: extra.actorId,
    volunteerId: extra.volunteerId,
    centerId: extra.centerId,
    source: extra.source ?? 'service',
    payload: extra.payload,
    error: extra.error,
  })
  if (extra.error) {
    console.warn('[FARO_MISSION]', action, record)
  } else {
    console.info('[FARO_MISSION]', action, record)
  }
  return record
}

/** Prefijo estable `[FARO_LOGISTICS]` para red logistica (reservas, recomendacion, entregas). */
export function logisticsLog(
  action:
    | 'inventory_updated'
    | 'centers_recommended'
    | 'reservation_created'
    | 'reservation_ready'
    | 'reservation_released'
    | 'volunteer_assigned'
    | 'resources_delivered'
    | 'mission_completed',
  extra: Partial<OperationalLogPayload> & { entityId: string },
): Record<string, unknown> {
  const record = operationalLog({
    entityType: extra.entityType ?? 'mission',
    entityId: extra.entityId,
    action,
    from: extra.from,
    to: extra.to,
    actorId: extra.actorId,
    volunteerId: extra.volunteerId,
    centerId: extra.centerId,
    missionId: extra.missionId,
    caseId: extra.caseId,
    source: extra.source ?? 'service',
    payload: extra.payload,
    error: extra.error,
  })
  if (extra.error) {
    console.warn('[FARO_LOGISTICS]', action, record)
  } else {
    console.info('[FARO_LOGISTICS]', action, record)
  }
  return record
}

/** Prefijo estable `[FARO_PIPELINE]` solo en transiciones canónicas. */
export function pipelineLog(
  action:
    | 'request_created'
    | 'gc_decision'
    | 'mission_created'
    | 'assignment_confirmed'
    | 'mission_closed'
    | 'case_resolved',
  extra: Partial<OperationalLogPayload> & { entityId: string },
): Record<string, unknown> {
  const record = operationalLog({
    entityType: extra.entityType ?? 'case',
    entityId: extra.entityId,
    action,
    from: extra.from,
    to: extra.to,
    actorId: extra.actorId,
    volunteerId: extra.volunteerId,
    centerId: extra.centerId,
    source: extra.source ?? 'service',
    payload: extra.payload,
    error: extra.error,
  })
  if (extra.error) {
    console.warn('[FARO_PIPELINE]', action, record)
  } else {
    console.info('[FARO_PIPELINE]', action, record)
  }
  return record
}

