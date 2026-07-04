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
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl: string) {
      console.info(`[FARO] Service Worker activo: ${swUrl}`)
    },
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
