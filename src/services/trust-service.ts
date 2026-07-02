import type { Center, Event, Need, Report } from '@/domain/models'
import type { Site } from '@/lib/types'
import { getTimelineByCenter } from '@/services/faro-service'
import { eventActionLabel, eventActorLabel } from '@/services/coordinator-service'
import type { FaroDataset } from '@/services/faro-service'

export type TrustLabel = 'Muy alta' | 'Alta' | 'Media' | 'Baja'
export type FreshnessState = 'fresh' | 'stale' | 'expired'
export type ActivityLevel = 'Muy activo' | 'Activo' | 'Poco activo' | 'Sin actividad reciente'

export interface TrustScoreResult {
  score: number
  label: TrustLabel
  updatedBy: string
  lastUpdated: Date
}

export interface FreshnessResult {
  state: FreshnessState
  label: string
  emoji: string
  lastUpdated: Date
}

export interface ActivityLevelResult {
  level: ActivityLevel
  recentEventCount: number
}

export interface CenterTimelineEntry {
  id: string
  at: Date
  actor: string
  action: string
  description: string
}

export interface CenterTrustSnapshot {
  trust: TrustScoreResult
  freshness: FreshnessResult
  activity: ActivityLevelResult
  timeline: CenterTimelineEntry[]
  reportCounts: { pending: number; verified: number }
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

function hoursSince(date: Date, now = Date.now()): number {
  return Math.max(0, (now - date.getTime()) / HOUR_MS)
}

function latestDate(dates: Date[]): Date {
  if (!dates.length) return new Date(0)
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

function resolveLastUpdated(site: Site, center: Center | undefined, needs: Need[], events: Event[]): Date {
  const candidates = [
    site.updatedAt,
    center?.updatedAt,
    ...needs.map((n) => n.updatedAt),
    ...events.map((e) => e.createdAt),
  ].filter(Boolean) as Date[]
  return latestDate(candidates)
}

function resolveUpdatedBy(events: Event[], center: Center | undefined): string {
  const recent = events[0]
  if (recent) {
    const actor = eventActorLabel(recent)
    if (recent.kind === 'report') return 'Reporte ciudadano verificado'
    if (recent.kind === 'inventory' || recent.kind === 'saturation') return 'Coordinador del centro'
    return actor
  }
  if (center?.responsible.name) return center.responsible.name
  return 'Coordinador del centro'
}

export function computeFreshness(lastUpdated: Date, now = Date.now()): FreshnessResult {
  const hours = hoursSince(lastUpdated, now)
  if (hours < 6) {
    return {
      state: 'fresh',
      label: 'Actualizado recientemente',
      emoji: '🟢',
      lastUpdated,
    }
  }
  if (hours < 48) {
    return {
      state: 'stale',
      label: 'Información puede estar desactualizada',
      emoji: '🟡',
      lastUpdated,
    }
  }
  return {
    state: 'expired',
    label: 'Información probablemente desactualizada',
    emoji: '🔴',
    lastUpdated,
  }
}

export function computeActivityLevel(events: Event[], now = Date.now()): ActivityLevelResult {
  const windowMs = 7 * DAY_MS
  const recentEventCount = events.filter((e) => now - e.createdAt.getTime() <= windowMs).length
  let level: ActivityLevel = 'Sin actividad reciente'
  if (recentEventCount >= 8) level = 'Muy activo'
  else if (recentEventCount >= 4) level = 'Activo'
  else if (recentEventCount >= 1) level = 'Poco activo'
  return { level, recentEventCount }
}

export function computeTrustScore(input: {
  site: Site
  center: Center | undefined
  needs: Need[]
  reports: Report[]
  events: Event[]
  lastUpdated: Date
  now?: number
}): TrustScoreResult {
  const { site, center, needs, reports, events, lastUpdated, now = Date.now() } = input
  const hours = hoursSince(lastUpdated, now)

  let recency = 5
  if (hours < 2) recency = 35
  else if (hours < 6) recency = 30
  else if (hours < 24) recency = 22
  else if (hours < 72) recency = 12

  const coordinatorEvents = events.filter(
    (e) => e.kind === 'inventory' || e.kind === 'saturation' || e.kind === 'resolved',
  )
  const recentCoordinator = coordinatorEvents.some((e) => now - e.createdAt.getTime() < 7 * DAY_MS)
  const recentNeedUpdates = needs.some((n) => now - n.updatedAt.getTime() < 2 * DAY_MS)
  let coordinatorFactor = recentCoordinator ? 25 : center?.responsible.name ? 15 : 8
  if (recentNeedUpdates) coordinatorFactor = Math.min(25, coordinatorFactor + 3)

  const verified = reports.filter((r) => r.status === 'verified')
  const pending = reports.filter((r) => r.status === 'new')
  const discarded = reports.filter((r) => r.status === 'discarded')
  const citizenFactor = Math.min(20, verified.length * 5)

  let conflictFactor = 20
  conflictFactor -= Math.min(15, pending.length * 5)
  if (discarded.length > verified.length) conflictFactor -= 8
  if (site.status === 'critical') conflictFactor -= 5
  conflictFactor = Math.max(0, conflictFactor)

  const score = Math.max(0, Math.min(100, recency + coordinatorFactor + citizenFactor + conflictFactor))

  let label: TrustLabel = 'Baja'
  if (score >= 85) label = 'Muy alta'
  else if (score >= 70) label = 'Alta'
  else if (score >= 50) label = 'Media'

  return {
    score,
    label,
    updatedBy: resolveUpdatedBy(events, center),
    lastUpdated,
  }
}

export function buildCenterTimeline(events: Event[], limit = 12): CenterTimelineEntry[] {
  return events.slice(0, limit).map((event) => ({
    id: event.id,
    at: event.createdAt,
    actor: eventActorLabel(event),
    action: eventActionLabel(event),
    description: event.detail || event.title,
  }))
}

export function buildCenterTrustSnapshot(
  site: Site,
  dataset: FaroDataset,
  options?: { timelineLimit?: number },
): CenterTrustSnapshot {
  const center = dataset.centers.find((c) => c.id === site.id)
  const needs = dataset.needs.filter((n) => n.centerId === site.id)
  const reports = dataset.reports.filter((r) => r.centerId === site.id)
  const events = getTimelineByCenter(site.id, dataset).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
  const lastUpdated = resolveLastUpdated(site, center, needs, events)
  const freshness = computeFreshness(lastUpdated)
  const activity = computeActivityLevel(events)
  const trust = computeTrustScore({ site, center, needs, reports, events, lastUpdated })

  return {
    trust,
    freshness,
    activity,
    timeline: buildCenterTimeline(events, options?.timelineLimit ?? 12),
    reportCounts: {
      pending: reports.filter((r) => r.status === 'new').length,
      verified: reports.filter((r) => r.status === 'verified').length,
    },
  }
}
