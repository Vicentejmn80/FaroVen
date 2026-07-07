/**
 * Servicio de detección de versiones para la PWA de FARO.
 *
 * Compara el bundle activo (__FARO_RELEASE_CODE__) contra /version.json del servidor.
 * Solo dispara el banner si AMBOS difieren (versión y commit), evitando falsos positivos
 * cuando solo cambia la fecha del build pero el código es el mismo.
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

const POLL_INTERVAL_MS = 5 * 60 * 1000
const CACHE_BUST_TTL_MS = 30 * 1000
const DISMISS_KEY = 'faro:update-dismissed'

let pollerTimer: ReturnType<typeof setInterval> | null = null
let lastChecked = 0
let updateAlreadyFired = false

function localVersion(): string {
  if (typeof __FARO_RELEASE_CODE__ !== 'undefined' && __FARO_RELEASE_CODE__) {
    return __FARO_RELEASE_CODE__
  }
  return 'FARO-dev'
}

function localCommit(): string {
  if (typeof __FARO_BUILD_COMMIT__ !== 'undefined' && __FARO_BUILD_COMMIT__) {
    return __FARO_BUILD_COMMIT__
  }
  return 'unknown'
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

function isUpdateAvailable(remote: VersionPayload): boolean {
  const local = localVersion()
  if (local === 'FARO-dev') return false

  // Requiere que versión Y commit difieran — evita alarmas si solo cambió el timestamp
  const versionDiffers = remote.version !== local
  const commitDiffers = Boolean(remote.commit && remote.commit !== localCommit())

  return versionDiffers && commitDiffers
}

function dispatchUpdateEvent(remote: VersionPayload) {
  if (updateAlreadyFired) return

  // Si el usuario descartó el banner en esta sesión, no volver a molestar
  // (salvo actualizaciones críticas)
  if (!remote.critical && sessionStorage.getItem(DISMISS_KEY) === remote.version) {
    return
  }

  updateAlreadyFired = true
  window.dispatchEvent(
    new CustomEvent<FaroUpdateEvent>('faro:version-update-available', {
      detail: { remote, local: localVersion(), critical: remote.critical },
    }),
  )
}

async function checkVersion() {
  const now = Date.now()
  if (now - lastChecked < CACHE_BUST_TTL_MS) return
  lastChecked = now

  const remote = await fetchRemoteVersion()
  if (!remote) return

  if (isUpdateAvailable(remote)) {
    dispatchUpdateEvent(remote)
  }
}

/** Marca la actualización como descartada para esta sesión. */
export function dismissVersionUpdate(version: string) {
  sessionStorage.setItem(DISMISS_KEY, version)
}

/** Inicia el poller. Llamar una sola vez desde main.tsx. */
export function startVersionPoller() {
  void checkVersion()

  if (pollerTimer) clearInterval(pollerTimer)
  pollerTimer = setInterval(() => void checkVersion(), POLL_INTERVAL_MS)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastChecked = 0
      void checkVersion()
    }
  })
}

export function stopVersionPoller() {
  if (pollerTimer) {
    clearInterval(pollerTimer)
    pollerTimer = null
  }
}
