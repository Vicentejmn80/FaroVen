import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCcw } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'

interface Props {
  children: ReactNode
  screenName?: string
}

interface State {
  error: Error | null
}

/** Captura fallos de carga de pantallas (chunks PWA desactualizados). */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FARO] Error en pantalla:', error, info.componentStack)
  }

  private reload = () => {
    if (window.__faroUpdateSW) {
      void window.__faroUpdateSW(true)
      return
    }
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <RefreshCcw className="h-8 w-8 text-info" />
          <div className="space-y-1">
            <p className="text-base font-medium text-ink">
              No se pudo cargar {this.props.screenName ?? 'esta pantalla'}
            </p>
            <p className="text-sm text-ink-muted">
              Suele ocurrir cuando la app instalada tiene una versión antigua. Actualiza FARO para continuar.
            </p>
          </div>
          <EmergencyButton variant="primary" size="md" onClick={this.reload}>
            Actualizar FARO
          </EmergencyButton>
        </div>
      )
    }
    return this.props.children
  }
}
