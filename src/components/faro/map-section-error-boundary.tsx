import { Component, type ErrorInfo, type ReactNode } from 'react'
import { MapPin, RefreshCcw } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'

interface Props {
  children: ReactNode
  /** Reset al cambiar de misión / vista para recuperar sin recargar toda la app. */
  resetKey?: string
  title?: string
  description?: string
  onRetry?: () => void
  onDismiss?: () => void
}

interface State {
  error: Error | null
}

/**
 * Boundary local para mapa / detalle de misión.
 * Los errores de Leaflet o datos geo NO deben tumbar ScreenErrorBoundary global.
 */
export class MapSectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[FARO] Map/detail section error (contained):', error.message, info.componentStack)
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  private clear = () => {
    this.setState({ error: null })
    this.props.onRetry?.()
  }

  render() {
    if (!this.state.error) return this.props.children

    const title = this.props.title ?? 'No pudimos mostrar esta vista del mapa'
    const description =
      this.props.description ??
      'Es posible que la ubicación aún no sea válida o el mapa se haya desincronizado. Puedes reintentar sin salir de FARO.'

    return (
      <div className="flex h-full min-h-[220px] items-center justify-center p-4">
        <GlassCard className="max-w-sm space-y-3 p-5 text-center">
          <MapPin className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-xs leading-relaxed text-ink-subtle">{description}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <EmergencyButton variant="primary" size="sm" onClick={this.clear}>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCcw className="h-3.5 w-3.5" />
                Reintentar
              </span>
            </EmergencyButton>
            {this.props.onDismiss && (
              <EmergencyButton variant="glass" size="sm" onClick={this.props.onDismiss}>
                Cerrar
              </EmergencyButton>
            )}
          </div>
        </GlassCard>
      </div>
    )
  }
}
