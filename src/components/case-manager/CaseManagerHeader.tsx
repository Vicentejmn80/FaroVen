import { Bell, UserRound } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { greeting } from '@/lib/utils'

interface CaseManagerHeaderProps {
  name: string
  pendingCount: number
  notificationCount?: number
  onLogoClick: () => void
  onOpenNotifications: () => void
  onOpenProfile: () => void
}

export function CaseManagerHeader({
  name,
  pendingCount,
  notificationCount = 0,
  onLogoClick,
  onOpenNotifications,
  onOpenProfile,
}: CaseManagerHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onLogoClick} className="flex items-center gap-2.5">
          <FaroIcon size={26} title="FARO" />
          <span className="text-[17px] font-semibold tracking-tight text-ink">FARO</span>
        </button>
        <div className="flex items-center gap-2">
          <EmergencyButton
            variant="glass"
            size="icon"
            onClick={onOpenNotifications}
            aria-label="Notificaciones"
            className="relative"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-base-900">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </EmergencyButton>
          <EmergencyButton variant="glass" size="icon" onClick={onOpenProfile} aria-label="Perfil">
            <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </EmergencyButton>
        </div>
      </div>
      <div>
        <p className="text-sm text-ink-subtle">
          {greeting()}, {name}
        </p>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          {pendingCount} casos nuevos esperan tu validación
        </h1>
      </div>
    </div>
  )
}
