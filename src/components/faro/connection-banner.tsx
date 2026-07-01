import { Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConnectionState } from '@/hooks/useNetworkStatus'
import { cn, timeAgo } from '@/lib/utils'

const STYLE: Record<ConnectionState, string> = {
  online: 'bg-operational/15 text-operational border-operational/30',
  unstable: 'bg-warning/15 text-warning border-warning/30',
  offline: 'bg-critical/15 text-critical border-critical/35',
}

function IconFor({ state }: { state: ConnectionState }) {
  if (state === 'offline') return <WifiOff className="h-4 w-4" />
  if (state === 'unstable') return <AlertTriangle className="h-4 w-4" />
  return <Wifi className="h-4 w-4" />
}

export function ConnectionBanner({
  state,
  label,
  cachedAt,
}: {
  state: ConnectionState
  label: string
  cachedAt?: Date | null
}) {
  const suffix = cachedAt ? ` Ultima actualizacion ${timeAgo(cachedAt)}.` : ''
  return (
    <AnimatePresence>
      {state !== 'online' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'mx-4 mt-1 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs',
            STYLE[state],
          )}
        >
          <IconFor state={state} />
          <span>
            {label}. Mostrando ultima informacion disponible.{suffix}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
