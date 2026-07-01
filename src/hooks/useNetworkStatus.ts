import { useEffect, useMemo, useState } from 'react'

export type ConnectionState = 'online' | 'unstable' | 'offline'

interface NetworkSnapshot {
  state: ConnectionState
  label: string
}

function getConnectionState(): ConnectionState {
  if (!navigator.onLine) return 'offline'

  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean; rtt?: number }
    }
  ).connection

  if (!connection) return 'online'
  if (connection.saveData) return 'unstable'
  if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') return 'unstable'
  if (typeof connection.rtt === 'number' && connection.rtt > 900) return 'unstable'
  return 'online'
}

function stateLabel(state: ConnectionState): string {
  if (state === 'online') return 'En linea'
  if (state === 'unstable') return 'Conectividad inestable'
  return 'Sin conexion'
}

export function useNetworkStatus() {
  const [state, setState] = useState<ConnectionState>(() => getConnectionState())

  useEffect(() => {
    const onOnline = () => setState(getConnectionState())
    const onOffline = () => setState('offline')
    const connection = (
      navigator as Navigator & {
        connection?: { addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void }
      }
    ).connection

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    connection?.addEventListener?.('change', onOnline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      connection?.removeEventListener?.('change', onOnline)
    }
  }, [])

  return useMemo<NetworkSnapshot>(
    () => ({ state, label: stateLabel(state) }),
    [state],
  )
}
