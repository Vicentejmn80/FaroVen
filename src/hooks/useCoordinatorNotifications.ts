import { useMemo } from 'react'
import { useCoordinatorReports } from '@/hooks/useCoordinatorPanel'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useAppMode } from '@/store/app-mode-context'

/** Reportes pendientes del centro asignado — alimenta la campanita del coordinador. */
export function useCoordinatorNotifications() {
  const { mode } = useAppMode()
  const { assignment } = useCoordinatorAssignment()
  const pendingReports = useCoordinatorReports('pending')

  const enabled = mode === 'coordinator' && !!assignment

  const pendingCount = useMemo(() => {
    if (!enabled) return 0
    return pendingReports.length
  }, [enabled, pendingReports.length])

  return {
    enabled,
    pendingCount,
    pendingReports,
    hasAlerts: pendingCount > 0,
  }
}
