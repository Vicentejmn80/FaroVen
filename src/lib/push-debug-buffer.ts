const MAX_ENTRIES = 40

const entries: string[] = []

export function appendPushDebugLog(line: string) {
  const stamped = `${new Date().toLocaleTimeString('es-VE')} ${line}`
  entries.push(stamped)
  if (entries.length > MAX_ENTRIES) entries.shift()
  window.dispatchEvent(new CustomEvent('faro:push-debug-log'))
}

export function getPushDebugLogs(): readonly string[] {
  return entries
}

export function clearPushDebugLogs() {
  entries.length = 0
  window.dispatchEvent(new CustomEvent('faro:push-debug-log'))
}

export function isPushDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_PUSH_DEBUG === 'true'
}

/** Panel visible solo en dev, o en prod con ?pushdebug=1 (no para todos los usuarios). */
export function isPushDebugPanelEnabled(): boolean {
  if (import.meta.env.DEV) return true
  if (import.meta.env.VITE_PUSH_DEBUG !== 'true') return false
  try {
    if (new URLSearchParams(window.location.search).get('pushdebug') === '1') {
      sessionStorage.setItem('faro:push-debug', '1')
      return true
    }
    return sessionStorage.getItem('faro:push-debug') === '1'
  } catch {
    return false
  }
}
