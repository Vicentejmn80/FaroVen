import { useMemo } from 'react'
import type { BlufMetric } from '@/lib/types'
import { buildTimelineEvents, getSummary } from '@/services/faro-service'
import { useCenters } from './useCenters'
import { useEvents } from './useEvents'
import { useNeeds } from './useNeeds'
import { useReports } from './useReports'

export function useSummary() {
  const centersQuery = useCenters()
  const needsQuery = useNeeds()
  const reportsQuery = useReports()
  const eventsQuery = useEvents()

  const summary = useMemo<BlufMetric[]>(() => {
    const centers = centersQuery.data ?? []
    const needs = needsQuery.data ?? []
    const reports = reportsQuery.data ?? []
    const storedEvents = eventsQuery.data ?? []
    const events = storedEvents.length
      ? storedEvents
      : buildTimelineEvents({ centers, needs, reports, events: [] }, { authoritativeEvents: false })
    return getSummary({ centers, needs, reports, events })
  }, [centersQuery.data, needsQuery.data, reportsQuery.data, eventsQuery.data])

  return {
    data: summary,
    isLoading: centersQuery.isLoading || needsQuery.isLoading || reportsQuery.isLoading || eventsQuery.isLoading,
  }
}
