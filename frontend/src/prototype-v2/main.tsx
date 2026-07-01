import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'leaflet/dist/leaflet.css'
import '@/styles/globals.css'
import './styles.css'
import { PrototypeApp } from './App'

// Cliente de datos propio del prototipo. Reutiliza los mismos hooks/queries
// que la app principal, pero con una instancia aislada para no interferir.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('prototype-root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrototypeApp />
    </QueryClientProvider>
  </StrictMode>
)
