const STORAGE_PREFIX = 'faro:dismissed-missions'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

export function loadDismissedMissionIds(userId: string | undefined): Set<string> {
  if (!userId || typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export function saveDismissedMissionIds(userId: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids]))
  } catch {
    // ignore quota / private mode
  }
}

export function dismissMissionForUser(userId: string, assignmentId: string): Set<string> {
  const next = loadDismissedMissionIds(userId)
  next.add(assignmentId)
  saveDismissedMissionIds(userId, next)
  return next
}
