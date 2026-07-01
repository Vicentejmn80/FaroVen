import { useMemo } from 'react'
import { useFaro } from '@/store/faro-context'
import { buildCenterTrustSnapshot, type CenterTrustSnapshot } from '@/services/trust-service'
import type { Site } from '@/lib/types'

export function useCenterTrust(site: Site | null): CenterTrustSnapshot | null {
  const { state } = useFaro()
  return useMemo(() => {
    if (!site) return null
    return buildCenterTrustSnapshot(site, state)
  }, [site, state])
}
