/**
 * Sesión de Radar operativo.
 *
 * Causa raíz del cierre prematuro (investigado 2026-07-30):
 * 1. El modal se montaba solo si `cases.find(id)` encontraba el caso.
 *    Tras openVolunteerCall → invalidateQueries/Realtime, la lista puede
 *    parpadear vacía un frame → unmount → se pierde step/timer → UI "apagada".
 * 2. onTimeUp en workspace hacía setEsperandoCasoId(null) → cerraba el modal.
 * 3. El timer vivía solo en state local (setInterval) sin deadline absoluto;
 *    cualquier remount reiniciaba o mataba la espera.
 * 4. startWaiting arrancaba el timer ANTES de que openVolunteerCall terminara;
 *    un onError devolvía a select-time mientras el interval seguía vivo.
 *
 * Contrato: el Radar permanece abierto exactamente hasta deadlineAt (o ∞).
 * Nunca se cierra solo antes de tiempo.
 */

export type RadarUiStep = 'select-time' | 'waiting' | 'results'

export interface RadarSession {
  caseId: string
  /** Snapshot estable: no depende de que el caso siga en la query list. */
  caseTitle: string
  caseZone: string
  casePriority: string
  step: RadarUiStep
  /** Epoch ms. null = espera infinita. undefined = aún no iniciada. */
  deadlineAt?: number | null
  selectedSeconds: number
}

const STORAGE_KEY = 'faro:radar-session'

export function loadRadarSession(): RadarSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RadarSession
    if (!parsed?.caseId) return null
    return parsed
  } catch {
    return null
  }
}

export function saveRadarSession(session: RadarSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* ignore quota / private mode */
  }
}

export function computeRemainingSeconds(deadlineAt: number | null | undefined): number {
  if (deadlineAt == null) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000))
}
