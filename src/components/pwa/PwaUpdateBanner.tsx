import { useEffect, useReducer } from 'react'
import { RefreshCcw, Zap } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { FaroUpdateEvent } from '@/services/version-service'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'banner'; critical: false; updating: boolean }
  | { phase: 'critical'; critical: true; updating: boolean }

type Action =
  | { type: 'SHOW_UPDATE'; critical: boolean }
  | { type: 'DISMISS' }
  | { type: 'START_UPDATE' }
  | { type: 'RESET' }

function reducer(state: UpdateState, action: Action): UpdateState {
  switch (action.type) {
    case 'SHOW_UPDATE':
      if (state.phase !== 'idle') return state
      return action.critical
        ? { phase: 'critical', critical: true, updating: false }
        : { phase: 'banner', critical: false, updating: false }
    case 'DISMISS':
      return state.phase === 'banner' ? { phase: 'idle' } : state
    case 'START_UPDATE':
      if (state.phase === 'idle') return state
      return { ...state, updating: true }
    case 'RESET':
      return { phase: 'idle' }
    default:
      return state
  }
}

/** Activa el nuevo Service Worker y fuerza recarga de la página. */
async function performUpdate() {
  // Si hay un SW esperando, lo activamos vía vite-plugin-pwa
  if (typeof window.__faroUpdateSW === 'function') {
    await window.__faroUpdateSW(true)
  }
  // Recarga de seguridad si el SW no relanzó la página (p.ej. sin SW waiting)
  setTimeout(() => location.reload(), 1500)
}

export function PwaUpdateBanner() {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle' })

  useEffect(() => {
    // Actualización detectada por el Service Worker (onNeedRefresh de vite-plugin-pwa)
    const onSwUpdate = () => dispatch({ type: 'SHOW_UPDATE', critical: false })
    window.addEventListener('faro:pwa-update-available', onSwUpdate)

    // Actualización detectada por el poller de version.json
    const onVersionUpdate = (e: Event) => {
      const detail = (e as CustomEvent<FaroUpdateEvent>).detail
      dispatch({ type: 'SHOW_UPDATE', critical: detail.critical })
    }
    window.addEventListener('faro:version-update-available', onVersionUpdate)

    return () => {
      window.removeEventListener('faro:pwa-update-available', onSwUpdate)
      window.removeEventListener('faro:version-update-available', onVersionUpdate)
    }
  }, [])

  const handleUpdate = async () => {
    dispatch({ type: 'START_UPDATE' })
    await performUpdate()
  }

  if (state.phase === 'idle') return null

  // ── Diálogo bloqueante para actualizaciones críticas ─────────────────────
  if (state.phase === 'critical') {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="faro-critical-title"
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      >
        <div className="w-full max-w-sm rounded-3xl border border-critical/30 bg-[#0B1327] p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical/15">
              <Zap className="h-5 w-5 text-critical" />
            </span>
            <div>
              <p id="faro-critical-title" className="text-[15px] font-semibold text-ink">
                Actualización requerida
              </p>
              <p className="text-xs text-ink-subtle">Versión crítica disponible</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Esta actualización contiene correcciones de seguridad o estabilidad esenciales. Debes actualizar para continuar usando FARO.
          </p>
          <EmergencyButton
            variant="primary"
            size="lg"
            className="mt-5 w-full"
            onClick={() => void handleUpdate()}
            disabled={state.updating}
          >
            <RefreshCcw className={`h-4 w-4 ${state.updating ? 'animate-spin' : ''}`} />
            {state.updating ? 'Actualizando…' : 'Actualizar y continuar'}
          </EmergencyButton>
        </div>
      </div>
    )
  }

  // ── Banner no-crítico (parte inferior, descartable) ───────────────────────
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-[80] mx-auto max-w-md"
    >
      <div className="rounded-2xl border border-info/25 bg-[#0B1327]/96 p-3.5 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.06]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10">
            <RefreshCcw className="h-4 w-4 text-info" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Nueva versión disponible</p>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Actualiza para ver los últimos cambios. Solo toma un segundo.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <EmergencyButton
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => void handleUpdate()}
            disabled={state.updating}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${state.updating ? 'animate-spin' : ''}`} />
            {state.updating ? 'Actualizando…' : 'Actualizar'}
          </EmergencyButton>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="flex-1"
            onClick={() => dispatch({ type: 'DISMISS' })}
            disabled={state.updating}
          >
            Más tarde
          </EmergencyButton>
        </div>
      </div>
    </div>
  )
}
