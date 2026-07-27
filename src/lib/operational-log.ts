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
