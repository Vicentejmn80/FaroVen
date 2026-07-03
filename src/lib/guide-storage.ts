const STORAGE_KEY = 'faro.emergency-kit.v1'

export function readKitChecked(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

export function writeKitChecked(state: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const FEEDBACK_KEY = 'faro.guide-feedback.v1'

export interface StoredFeedback {
  id: string
  category: string
  message: string
  email?: string
  createdAt: string
}

export function appendFeedback(entry: Omit<StoredFeedback, 'id' | 'createdAt'>): StoredFeedback {
  const record: StoredFeedback = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY)
    const list = raw ? (JSON.parse(raw) as StoredFeedback[]) : []
    list.unshift(record)
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(0, 50)))
  } catch {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify([record]))
  }
  return record
}
