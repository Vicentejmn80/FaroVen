import { useEffect, useMemo, useState } from 'react'

interface DiagnosticsState {
  standalone: boolean
  swController: boolean
  swScriptUrl: string
  caches: string[]
  manifestSummary: string
  pushPermission: string
  oneSignalConfigured: boolean
}

const initialState: DiagnosticsState = {
  standalone: false,
  swController: false,
  swScriptUrl: '—',
  caches: [],
  manifestSummary: '—',
  pushPermission: 'unknown',
  oneSignalConfigured: false,
}

/** Panel temporal de diagnóstico PWA solo en desarrollo. */
export function PwaDiagnosticsPanel() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DiagnosticsState>(initialState)

  useEffect(() => {
    const load = async () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true)

      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
      const cacheNames = 'caches' in window ? await caches.keys() : []

      let manifestSummary = '—'
      try {
        const response = await fetch('/manifest.webmanifest', { cache: 'no-store' })
        if (response.ok) {
          const manifest = (await response.json()) as Record<string, unknown>
          manifestSummary = `${String(manifest.name ?? 'app')} | start: ${String(manifest.start_url ?? '/')}`
        }
      } catch {
        manifestSummary = 'manifest no disponible'
      }

      setState({
        standalone,
        swController: Boolean(navigator.serviceWorker?.controller),
        swScriptUrl: registration?.active?.scriptURL ?? registration?.waiting?.scriptURL ?? '—',
        caches: cacheNames,
        manifestSummary,
        pushPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
        oneSignalConfigured: Boolean(import.meta.env.VITE_ONESIGNAL_APP_ID),
      })
    }
    void load()
  }, [])

  const mode = useMemo(() => (state.standalone ? 'PWA instalada' : 'Navegador web'), [state.standalone])

  if (!import.meta.env.DEV) return null

  return (
    <div className="fixed bottom-4 right-4 z-[95] max-w-[92vw]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-white/20 bg-black/70 px-3 py-2 text-xs text-white"
      >
        {open ? 'Ocultar diagnóstico PWA' : 'Diagnóstico PWA'}
      </button>
      {open && (
        <div className="mt-2 w-[420px] max-w-[92vw] rounded-2xl border border-white/20 bg-black/80 p-3 text-xs text-white">
          <p>Build: {__FARO_BUILD_DATE__}</p>
          <p>Commit: {__FARO_BUILD_COMMIT__}</p>
          <p>Modo: {mode}</p>
          <p>Service Worker activo: {state.swController ? 'sí' : 'no'}</p>
          <p>SW script: {state.swScriptUrl}</p>
          <p>Manifest: {state.manifestSummary}</p>
          <p>Permiso push: {state.pushPermission}</p>
          <p>OneSignal env cargado: {state.oneSignalConfigured ? 'sí' : 'no'}</p>
          <p>VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL ? 'ok' : 'missing'}</p>
          <p>VITE_ONESIGNAL_APP_ID: {import.meta.env.VITE_ONESIGNAL_APP_ID ? 'ok' : 'missing'}</p>
          <p className="mt-2 text-ink-subtle">Caches: {state.caches.length ? state.caches.join(', ') : 'ninguna'}</p>
        </div>
      )}
    </div>
  )
}
