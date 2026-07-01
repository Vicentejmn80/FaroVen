import { cn } from '@/lib/utils'
import type { ConnectionState } from '@/hooks/useNetworkStatus'

/**
 * LiveIndicator — punto verde con halo pulsante. Transmite que los datos
 * están vivos, sin ruido. Usado en el header.
 */
export function LiveIndicator({ className, label = 'En vivo' }: { className?: string; label?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-operational" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-operational" />
      </span>
      <span className="text-xs font-medium tracking-wide text-operational">{label}</span>
    </div>
  )
}

const TONE: Record<ConnectionState, { dot: string; text: string }> = {
  online: { dot: 'bg-operational', text: 'text-operational' },
  unstable: { dot: 'bg-warning', text: 'text-warning' },
  offline: { dot: 'bg-critical', text: 'text-critical' },
}

export function ConnectivityIndicator({
  className,
  state,
  label,
}: {
  className?: string
  state: ConnectionState
  label: string
}) {
  const tone = TONE[state]
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-2 w-2">
        <span className={cn('absolute inline-flex h-full w-full animate-pulse-ring rounded-full', tone.dot)} />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', tone.dot)} />
      </span>
      <span className={cn('text-xs font-medium tracking-wide', tone.text)}>{label}</span>
    </div>
  )
}
