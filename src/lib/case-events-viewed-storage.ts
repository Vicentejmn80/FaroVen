const STORAGE_PREFIX = 'faro:case-events-viewed'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

/** Mapa caseId → ISO timestamp de última vez que el GC abrió la ficha. */
export function loadCaseEventsViewedAt(userId: string | undefined): Record<string, string> {
  if (!userId || typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function markCaseEventsViewed(
  userId: string,
  caseId: string,
  at: Date = new Date(),
): Record<string, string> {
  const next = { ...loadCaseEventsViewedAt(userId), [caseId]: at.toISOString() }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return next
}

export function countUnseenEvents(
  events: Array<{ createdAt: Date }>,
  lastViewedIso?: string,
): number {
  if (!events.length) return 0
  const cutoff = lastViewedIso ? new Date(lastViewedIso).getTime() : 0
  if (!Number.isFinite(cutoff) || cutoff <= 0) return events.length
  return events.filter((e) => e.createdAt.getTime() > cutoff).length
}
