import { useEffect, useMemo, useState } from 'react'
import type { Event } from '@/domain/models'
import type { ActivityEvent } from '@/lib/types'
import { getActivityFeed, getGuideLibrary, getSites, toActivityEvent } from '@/services/faro-service'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { isSupabaseEnabled } from '@/lib/supabase'
import { FARO_QUERY_KEYS } from './query-keys'
import { useCenters } from './useCenters'
import { useEvents } from './useEvents'
import { useNeeds } from './useNeeds'
import { useReports } from './useReports'
import { useSummary } from './useSummary'

function firstErrorMessage(errors: unknown[]): string | null {
  for (const err of errors) {
    if (err instanceof Error) return err.message
  }
  return null
}

const FARO_CACHE_KEY = 'faro.cache.v1'

type CachedFaroPayload = {
  centers: unknown[]
  needs: unknown[]
  reports: unknown[]
  events: unknown[]
  cachedAt: string
}

function reviveDates(input: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...input }
  if (typeof copy['updatedAt'] === 'string') copy['updatedAt'] = new Date(copy['updatedAt'])
  if (typeof copy['createdAt'] === 'string') copy['createdAt'] = new Date(copy['createdAt'])
  return copy
}

function readCachedPayload(): CachedFaroPayload | null {
  try {
    const raw = localStorage.getItem(FARO_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedFaroPayload
  } catch {
    return null
  }
}

export function useFaroData() {
  const centersQuery = useCenters()
  const needsQuery = useNeeds()
  const reportsQuery = useReports()
  const eventsQuery = useEvents()
  const summaryQuery = useSummary()

  useRealtimeSync({
    channelName: 'faro-live-core',
    tables: ['hospitals', 'shelters', 'supply_centers', 'needs', 'reports', 'events', 'site_saturation'],
    invalidateKeys: [
      FARO_QUERY_KEYS.centers,
      FARO_QUERY_KEYS.needs,
      FARO_QUERY_KEYS.reports,
      FARO_QUERY_KEYS.events,
      FARO_QUERY_KEYS.summary,
      FARO_QUERY_KEYS.siteSaturation,
    ],
  })

  const [cached, setCached] = useState<CachedFaroPayload | null>(() =>
    typeof window === 'undefined' ? null : readCachedPayload(),
  )

  const hasLiveData =
    Boolean(centersQuery.data?.length) ||
    Boolean(needsQuery.data?.length) ||
    Boolean(reportsQuery.data?.length) ||
    Boolean(eventsQuery.data?.length)

  const centers = (centersQuery.data ??
    (cached?.centers.map((item) => reviveDates(item as Record<string, unknown>)) as typeof centersQuery.data) ??
    []) as NonNullable<typeof centersQuery.data>
  const needs = (needsQuery.data ??
    (cached?.needs.map((item) => reviveDates(item as Record<string, unknown>)) as typeof needsQuery.data) ??
    []) as NonNullable<typeof needsQuery.data>
  const reports = (reportsQuery.data ??
    (cached?.reports.map((item) => reviveDates(item as Record<string, unknown>)) as typeof reportsQuery.data) ??
    []) as NonNullable<typeof reportsQuery.data>
  const events = (eventsQuery.data ??
    (cached?.events.map((item) => reviveDates(item as Record<string, unknown>)) as typeof eventsQuery.data) ??
    []) as NonNullable<typeof eventsQuery.data>
  const guideLibrary = getGuideLibrary()
  const sites = getSites({ centers, needs, reports, events })

  const latestActivity = useMemo<ActivityEvent[]>(() => {
    if (events.length) return events.slice(0, 8).map((event: Event) => toActivityEvent(event))
    return getActivityFeed(8, { centers, needs, reports, events })
  }, [centers, needs, reports, events])

  const loadError = useMemo(() => {
    if (!isSupabaseEnabled) {
      return 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env para cargar datos reales.'
    }
    return firstErrorMessage([
      centersQuery.error,
      needsQuery.error,
      reportsQuery.error,
      eventsQuery.error,
    ])
  }, [centersQuery.error, needsQuery.error, reportsQuery.error, eventsQuery.error])

  useEffect(() => {
    if (!hasLiveData) return
    const payload: CachedFaroPayload = {
      centers,
      needs,
      reports,
      events,
      cachedAt: new Date().toISOString(),
    }
    setCached(payload)
    try {
      localStorage.setItem(FARO_CACHE_KEY, JSON.stringify(payload))
    } catch {
      // noop
    }
  }, [centers, needs, reports, events, hasLiveData])

  return {
    centers,
    needs,
    reports,
    events,
    sites,
    latestActivity,
    summary: summaryQuery.data,
    guideLibrary,
    cachedAt: cached?.cachedAt ? new Date(cached.cachedAt) : null,
    loadError,
    isLoading:
      centersQuery.isLoading ||
      needsQuery.isLoading ||
      reportsQuery.isLoading ||
      eventsQuery.isLoading ||
      summaryQuery.isLoading,
  }
}
