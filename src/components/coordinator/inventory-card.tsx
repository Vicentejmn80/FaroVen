import { Package, Droplets, Pill, Apple, BedDouble, Baby, Shirt } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'

const INVENTORY_ICONS: Record<string, typeof Package> = {
  agua: Droplets,
  medicinas: Pill,
  alimentos: Apple,
  colchones: BedDouble,
  mantas: Shirt,
  leche: Baby,
}

interface InventoryItem {
  name: string
  quantity: number
  unit: string
  status: 'ok' | 'low' | 'critical'
}

interface InventoryCardProps {
  items: InventoryItem[]
  onUpdate: (itemName: string) => void
}

const STATUS_STYLES = {
  ok: 'text-operational',
  low: 'text-warning',
  critical: 'text-critical',
}

const STATUS_BG = {
  ok: 'bg-operational/15',
  low: 'bg-warning/15',
  critical: 'bg-critical/15',
}

export function InventoryCard({ items, onUpdate }: InventoryCardProps) {
  if (items.length === 0) {
    return (
      <GlassCard className="text-sm text-ink-muted">
        No hay inventario registrado.
      </GlassCard>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const Icon = INVENTORY_ICONS[item.name.toLowerCase()] ?? Package
        return (
          <GlassCard key={item.name} className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                STATUS_BG[item.status],
              )}
            >
              <Icon className={cn('h-5 w-5', STATUS_STYLES[item.status])} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.name}</p>
              <p className={cn('text-xs font-medium', STATUS_STYLES[item.status])}>
                {item.quantity} {item.unit}
              </p>
            </div>
            <EmergencyButton
              variant="glass"
              size="sm"
              onClick={() => onUpdate(item.name)}
            >
              Actualizar
            </EmergencyButton>
          </GlassCard>
        )
      })}
    </div>
  )
}
