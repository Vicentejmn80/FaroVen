import { useMemo } from 'react'
import { useFaro } from '@/store/faro-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import {
  buildCoordinatorDashboard,
  filterCenterEvents,
  reportInboxFilter,
  type CoordinatorDashboardMetrics,
  type InboxFilter,
} from '@/services/coordinator-service'
import { getTimelineByCenter } from '@/services/faro-service'
import type { Event, Need, Report } from '@/domain/models'
import type { Site } from '@/lib/types'

export function useCoordinatorSite(): Site | null {
  const { sites } = useFaro()
  const { assignment } = useCoordinatorAssignment()
  return useMemo(
    () => sites.find((s) => s.id === assignment?.siteId) ?? null,
    [sites, assignment?.siteId],
  )
}

export function useCoordinatorDashboard(): CoordinatorDashboardMetrics | null {
  const site = useCoordinatorSite()
  const { state } = useFaro()
  return useMemo(() => {
    if (!site) return null
    const center = state.centers.find((c) => c.id === site.id)
    return buildCoordinatorDashboard(site, center, state.needs, state.reports)
  }, [site, state.centers, state.needs, state.reports])
}

export function useCoordinatorNeeds(): Need[] {
  const site = useCoordinatorSite()
  const { state } = useFaro()
  return useMemo(() => {
    if (!site) return []
    return state.needs
      .filter((n) => n.centerId === site.id)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }, [site, state.needs])
}

export function useCoordinatorReports(filter: InboxFilter = 'all'): Report[] {
  const site = useCoordinatorSite()
  const { state } = useFaro()
  return useMemo(() => {
    if (!site) return []
    return state.reports
      .filter((r) => r.centerId === site.id && reportInboxFilter(r, filter))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [site, state.reports, filter])
}

export function useCoordinatorHistory(): Event[] {
  const site = useCoordinatorSite()
  const { state } = useFaro()
  return useMemo(() => {
    if (!site) return []
    const fromEvents = filterCenterEvents(state.events, site.id)
    if (fromEvents.length) return fromEvents
    return getTimelineByCenter(site.id, state)
  }, [site, state])
}
