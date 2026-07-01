import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { QueryProvider } from './providers/query-provider'
import { FaroProvider } from './store/faro-context'
import { AppModeProvider } from './store/app-mode-context'
import { CoordinatorProvider } from './store/coordinator-context'
import { ToastProvider } from './store/toast-context'
import 'leaflet/dist/leaflet.css'
import './index.css'

registerSW({
  immediate: true,
  onRegisteredSW(swUrl: string) {
    console.info(`[FARO] Service Worker activo: ${swUrl}`)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AppModeProvider>
        <ToastProvider>
          <CoordinatorProvider>
            <FaroProvider>
              <App />
            </FaroProvider>
          </CoordinatorProvider>
        </ToastProvider>
      </AppModeProvider>
    </QueryProvider>
  </StrictMode>,
)
