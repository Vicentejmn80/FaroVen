/**
 * Servicio de detección de versiones para la PWA de FARO.
 *
 * Flujo:
 *  1. Al montar la app consulta /version.json.
 *  2. Compara con la versión grabada en build-time (__FARO_RELEASE_CODE__).
 *  3. Si difieren, emite 'faro:version-update-available' con { critical }.
 *  4. Repite cada POLL_INTERVAL_MS y también al volver a abrir la app (visibilitychange).
 *
 * La variable de entorno FARO_CRITICAL_UPDATE=true en el build establece el flag
 * critical en version.json, lo que mostrará un diálogo bloqueante.
 */

export interface VersionPayload {
  version: string
  buildDate: string
  commit?: string
  critical: boolean
}

export interface FaroUpdateEvent {
  remote: VersionPayload
  local: string
  critical: boolean
}

const POLL_INTERVAL_MS = 5 * 60 * 1000   // 5 minutos
const CACHE_BUST_TTL_MS = 30 * 1000      // re-consultar si han pasado >30s sin resultado

let pollerTimer: ReturnType<typeof setInterval> | null = null
let lastChecked = 0
let updateAlreadyFired = false

function localVersion(): string {
  if (typeof __FARO_RELEASE_CODE__ !== 'undefined' && __FARO_RELEASE_CODE__) {
    return __FARO_RELEASE_CODE__
  }
  return 'FARO-dev'
}

async function fetchRemoteVersion(): Promise<VersionPayload | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return null
    return (await res.json()) as VersionPayload
  } catch {
    return null
  }
}

function dispatchUpdateEvent(remote: VersionPayload) {
  if (updateAlreadyFired) return
  const event: FaroUpdateEvent = {
    remote,
    local: localVersion(),
    critical: remote.critical,
  }
  updateAlreadyFired = true
  window.dispatchEvent(
    new CustomEvent<FaroUpdateEvent>('faro:version-update-available', { detail: event }),
  )
}

async function checkVersion() {
  const now = Date.now()
  if (now - lastChecked < CACHE_BUST_TTL_MS) return
  lastChecked = now

  const remote = await fetchRemoteVersion()
  if (!remote) return

  const local = localVersion()

  // En dev local ('FARO-dev') no disparar falsas alarmas
  if (local === 'FARO-dev') return

  if (remote.version !== local) {
    dispatchUpdateEvent(remote)
  }
}

/** Inicia el poller. Llamar una sola vez desde main.tsx. */
export function startVersionPoller() {
  // Chequeo inmediato al arrancar
  void checkVersion()

  // Polling periódico
  if (pollerTimer) clearInterval(pollerTimer)
  pollerTimer = setInterval(() => void checkVersion(), POLL_INTERVAL_MS)

  // Chequeo al volver a la app (tab en primer plano, especialmente útil en Android/iOS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastChecked = 0   // forzar nueva consulta
      void checkVersion()
    }
  })
}

/** Detiene el poller (útil en tests). */
export function stopVersionPoller() {
  if (pollerTimer) {
    clearInterval(pollerTimer)
    pollerTimer = null
  }
}
