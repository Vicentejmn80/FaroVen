import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCcw } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { isChunkLoadError } from '@/lib/lazy-with-retry'
import { clearPwaAssetCaches } from '@/lib/pwa-cache'

interface Props {
  children: ReactNode
  screenName?: string
  /** Cambia al navegar entre pantallas para resetear errores previos. */
  resetKey?: string
}

interface State {
  error: Error | null
  isChunkError: boolean
}

/**
 * Captura errores de renderizado y fallos de carga de chunks lazy.
 * NO está conectado al poller de version.json — son mecanismos independientes.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null, isChunkError: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, isChunkError: isChunkLoadError(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FARO] Error en pantalla:', error.message, info.componentStack)

    if (isChunkLoadError(error)) {
      // Avisar al banner de actualización por si el SW aún no lo detectó
      window.dispatchEvent(new CustomEvent('faro:pwa-update-available'))
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, isChunkError: false })
    }
  }

  private reload = async () => {
    await clearPwaAssetCaches()

    if (window.__faroUpdateSW) {
      try {
        await window.__faroUpdateSW(true)
      } catch {
        // noop
      }
    }
    // Siempre recargar — el SW puede no tener una versión waiting
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      const chunk = this.state.isChunkError
      return (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <RefreshCcw className="h-8 w-8 text-info" />
          <div className="space-y-1">
            <p className="text-base font-medium text-ink">
              No se pudo cargar {this.props.screenName ?? 'esta pantalla'}
            </p>
            <p className="text-sm text-ink-muted">
              {chunk
                ? 'La app tiene una versión desactualizada en caché. Actualiza FARO para cargar esta sección.'
                : 'Ocurrió un error inesperado. Intenta recargar la página.'}
            </p>
            {import.meta.env.DEV && (
              <p className="mt-2 break-all text-xs text-critical">{this.state.error.message}</p>
            )}
          </div>
          <EmergencyButton variant="primary" size="md" onClick={() => void this.reload()}>
            {chunk ? 'Actualizar FARO' : 'Recargar'}
          </EmergencyButton>
        </div>
      )
    }
    return this.props.children
  }
}
