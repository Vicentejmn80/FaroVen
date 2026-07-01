import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'

interface ScreenScaffoldProps {
  title: string
  subtitle?: string
  onBack?: () => void
  action?: ReactNode
  children: ReactNode
}

/**
 * ScreenScaffold — esqueleto reutilizable para vistas secundarias
 * (Detalle, Reporte, Guía, Perfil). Mantiene el mismo lenguaje visual:
 * back, título contenido, contenido desplazable sin scrollbar.
 */
export function ScreenScaffold({ title, subtitle, onBack, action, children }: ScreenScaffoldProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-4 pt-safe pb-3">
        {onBack && (
          <EmergencyButton variant="glass" size="icon" onClick={onBack} aria-label="Volver">
            <ChevronLeft className="h-5 w-5" />
          </EmergencyButton>
        )}
        <div className="flex-1">
          {subtitle && <p className="text-xs text-ink-subtle">{subtitle}</p>}
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        </div>
        {action}
      </header>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-32 lg:px-8 lg:pb-8">{children}</div>
    </div>
  )
}
