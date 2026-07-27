type LogSource = 'ui' | 'service' | 'realtime' | 'system'

export interface OperationalLogPayload {
  entityType: 'case' | 'mission' | 'assignment' | 'application' | 'report' | 'public_need'
  entityId: string
  action: string
  from?: string | null
  to?: string | null
  actorId?: string | null
  actorRole?: string | null
  volunteerId?: string | null
  centerId?: string | null
  source?: LogSource
  payload?: Record<string, unknown>
  durationMs?: number
  error?: string | null
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
    duration_ms: entry.durationMs ?? null,
    error: entry.error ?? null,
    payload: entry.payload ?? {},
  }

  if (entry.error) {
    console.warn('[FARO_OPS]', record)
  } else {
    console.info('[FARO_OPS]', record)
  }

  return record
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

