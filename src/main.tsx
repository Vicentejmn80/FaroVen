import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { QueryProvider } from './providers/query-provider'
import { AuthProvider } from './store/auth-context'
import { FaroProvider } from './store/faro-context'
import { CoordinatorProvider } from './store/coordinator-context'
import { ToastProvider } from './store/toast-context'
import 'leaflet/dist/leaflet.css'
import './index.css'

import { pushService } from '@/push-service/push-service'

/** SW de Vite PWA solo en producción; en dev evita conflicto con OneSignal. */
if (import.meta.env.PROD) {
  let swRegistration: ServiceWorkerRegistration | undefined

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(swUrl: string, registration) {
      console.info(`[FARO] Service Worker activo: ${swUrl}`)
      swRegistration = registration
      if (registration) {
        setInterval(() => {
          void registration.update()
        }, 60_000)
      }
    },
    onNeedRefresh() {
      // Respaldo: con autoUpdate la página recarga sola; el banner cubre edge cases en Android.
      window.dispatchEvent(new CustomEvent('faro:pwa-update-available'))
    },
    onOfflineReady() {
      console.info('[FARO] Contenido listo para uso offline')
    },
  })
  window.__faroUpdateSW = updateSW

  // Al volver a la app (p. ej. Redmi/Xiaomi), forzar chequeo de nueva versión.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && swRegistration) {
      void swRegistration.update()
    }
  })
}

void pushService.initialize()

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
