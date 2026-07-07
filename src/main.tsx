import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { QueryProvider } from './providers/query-provider'
import { AuthProvider } from './store/auth-context'
import { FaroProvider } from './store/faro-context'
import { CoordinatorProvider } from './store/coordinator-context'
import { ToastProvider } from './store/toast-context'
import { startVersionPoller } from './services/version-service'
import 'leaflet/dist/leaflet.css'
import './index.css'

/**
 * Service Worker de Vite PWA en modo 'prompt':
 * — el nuevo SW espera en estado "waiting" hasta que el usuario confirma en el banner.
 * — Evita recargas inesperadas mientras el usuario trabaja.
 * — Solo activo en producción para no interferir con el dev-server.
 */
if (import.meta.env.PROD) {
  let swRegistration: ServiceWorkerRegistration | undefined

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl: string, registration) {
      swRegistration = registration
      if (registration) {
        // Polling de SW cada 60s como mecanismo secundario de detección
        setInterval(() => void registration.update(), 60_000)
      }
    },
    onNeedRefresh() {
      // Nuevo SW en estado "waiting" — el banner decidirá cuándo activarlo
      window.dispatchEvent(new CustomEvent('faro:pwa-update-available'))
    },
    onOfflineReady() {
      console.info('[FARO] Contenido listo para uso offline')
    },
  })

  window.__faroUpdateSW = updateSW

  // Al volver a primer plano (especialmente útil en Android/Xiaomi), chequear SW
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && swRegistration) {
      void swRegistration.update()
    }
  })

  // Poller de version.json — detección adicional por si el SW no notifica
  startVersionPoller()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <CoordinatorProvider>
            <FaroProvider>
              <App />
            </FaroProvider>
          </CoordinatorProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  </StrictMode>,
)
