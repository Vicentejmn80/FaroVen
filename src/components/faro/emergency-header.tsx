import { Bell, CircleHelp } from 'lucide-react'
import { ConnectivityIndicator } from './live-indicator'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { FaroIcon } from '@/components/brand/faro-icon'
import { cn } from '@/lib/utils'
import type { ConnectionState } from '@/hooks/useNetworkStatus'

interface EmergencyHeaderProps {
  notifications?: number
  onNotifications?: () => void
  connectionState?: ConnectionState
  connectionLabel?: string
  className?: string
}

function FaroWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <FaroIcon size={26} title="FARO" />
      <span className="text-[17px] font-semibold tracking-tight text-ink">FARO</span>
    </div>
  )
}

export function EmergencyHeader({
  notifications = 0,
  onNotifications,
  connectionState = 'online',
  connectionLabel = 'En linea',
  className,
}: EmergencyHeaderProps) {
  const openHelp = () => {
    window.dispatchEvent(new CustomEvent('faro:open-help-center'))
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center justify-between px-5 pt-safe pb-3 lg:px-8',
        className,
      )}
    >
      <FaroWordmark />
      <div className="flex items-center gap-2">
        <ConnectivityIndicator state={connectionState} label={connectionLabel} />
        <EmergencyButton
          variant="glass"
          size="icon"
          onClick={openHelp}
          aria-label="¿Cómo funciona FARO?"
          title="¿Cómo funciona FARO?"
        >
          <CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </EmergencyButton>
        <EmergencyButton
          variant="glass"
          size="icon"
          onClick={onNotifications}
          aria-label="Notificaciones"
          className="relative"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {notifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-base-900">
              {notifications > 9 ? '9+' : notifications}
            </span>
          )}
        </EmergencyButton>
      </div>
    </header>
  )
}
