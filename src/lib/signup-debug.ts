/** Logs temporales de diagnóstico de registro. Activar en prod con VITE_SIGNUP_DEBUG=1 */
export function countSignupDebug(label: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_SIGNUP_DEBUG !== '1') return
  console.count(`[FARO signup-debug] ${label}`)
  if (detail) console.debug('[FARO signup-debug]', detail)
}
