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
