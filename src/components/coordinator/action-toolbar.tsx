import type { LucideIcon } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'

interface ActionItem {
  icon: LucideIcon
  label: string
  onClick: () => void
  variant?: 'glass' | 'primary'
  disabled?: boolean
}

interface ActionToolbarProps {
  actions: ActionItem[]
  className?: string
}

export function ActionToolbar({ actions, className }: ActionToolbarProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <EmergencyButton
            key={action.label}
            variant={action.variant ?? 'glass'}
            size="sm"
            disabled={action.disabled}
            onClick={action.onClick}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </EmergencyButton>
        )
      })}
    </div>
  )
}
