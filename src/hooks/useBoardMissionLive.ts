import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import type { MissionAssignmentStatus } from '@/domain/mission.types'
import type { CaseMissionLive } from '@/domain/kanban-mission-timeline'
import {
  countUnseenEvents,
  loadCaseEventsViewedAt,
} from '@/lib/case-events-viewed-storage'

interface RawMission {
  id: string
  case_id: string | null
}

interface RawAssignment {
  id: string
  mission_id: string
  status: string
  assigned_at: string
}

interface RawEvent {
  id: string
  mission_id: string
  event_type: string
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

async function fetchBoardMissionLive(caseIds: string[]): Promise<CaseMissionLive[]> {
  if (caseIds.length === 0) return []

  const { data: missions, error: mErr } = await supabase
    .from('missions')
    .select('id, case_id')
    .in('case_id', caseIds)
    .not('status', 'in', '("cancelled","archived")')
    .order('created_at', { ascending: false })
    .limit(200)
  if (mErr) throw mErr

  const missionRows = (missions ?? []) as RawMission[]
  if (missionRows.length === 0) return []

  // Una misión por caso (la más reciente)
  const missionByCase = new Map<string, string>()
  for (const m of missionRows) {
    if (!m.case_id) continue
    if (!missionByCase.has(m.case_id)) missionByCase.set(m.case_id, m.id)
  }

  const missionIds = [...new Set(missionByCase.values())]
  const caseByMission = new Map<string, string>()
  for (const [caseId, missionId] of missionByCase) {
    caseByMission.set(missionId, caseId)
  }

  const [{ data: assignments, error: aErr }, { data: events, error: eErr }] = await Promise.all([
    supabase
      .from('mission_assignments')
      .select('id, mission_id, status, assigned_at')
      .in('mission_id', missionIds)
      .not('status', 'in', '("rejected","cancelled")')
      .order('assigned_at', { ascending: false })
      .limit(400),
    supabase
      .from('mission_events')
      .select('id, mission_id, event_type, description, metadata, created_at')
      .in('mission_id', missionIds)
      .order('created_at', { ascending: false })
      .limit(500),
  ])
  if (aErr) throw aErr
  if (eErr) throw eErr

  const assignmentByMission = new Map<string, RawAssignment>()
  for (const a of (assignments ?? []) as RawAssignment[]) {
    if (!assignmentByMission.has(a.mission_id)) assignmentByMission.set(a.mission_id, a)
  }

  const eventsByMission = new Map<string, RawEvent[]>()
  for (const ev of (events ?? []) as RawEvent[]) {
    const list = eventsByMission.get(ev.mission_id) ?? []
    list.push(ev)
    eventsByMission.set(ev.mission_id, list)
  }

  const result: CaseMissionLive[] = []
  for (const [caseId, missionId] of missionByCase) {
    const assignment = assignmentByMission.get(missionId)
    if (!assignment) continue
    const missionEvents = (eventsByMission.get(missionId) ?? []).map((ev) => ({
      id: ev.id,
      eventType: ev.event_type,
      createdAt: new Date(ev.created_at),
      description: ev.description ?? undefined,
    }))

    let delayMinutes: number | null = null
    for (const ev of (eventsByMission.get(missionId) ?? [])) {
      if (ev.event_type !== 'eta_delay') continue
      const mins = Number(ev.metadata?.delayMinutes)
      if (Number.isFinite(mins) && mins > 0) {
        delayMinutes = mins
        break
      }
      const match = ev.description?.match(/\+(\d+)/)
      if (match) {
        delayMinutes = Number(match[1])
        break
      }
    }

    result.push({
      caseId,
      missionId,
      assignmentId: assignment.id,
      assignmentStatus: assignment.status as MissionAssignmentStatus,
      delayMinutes,
      latestEventAt: missionEvents[0]?.createdAt ?? null,
      events: missionEvents,
    })
  }

  return result
}

/**
 * Estado de misión en vivo para todas las tarjetas EN PROGRESO del tablero.
 * `viewedTick` fuerza recálculo del badge al abrir una ficha.
 */
export function useBoardMissionLive(
  caseIds: string[],
  userId?: string,
  viewedTick = 0,
) {
  const key = useMemo(() => [...caseIds].sort().join(','), [caseIds])

  useRealtimeSync({
    channelName: caseIds.length ? 'ops-board-mission-live' : 'ops-board-mission-live-idle',
    tables: caseIds.length ? ['missions', 'mission_assignments', 'mission_events'] : [],
    invalidateKeys: caseIds.length
      ? [FARO_QUERY_KEYS.missions, FARO_QUERY_KEYS.missionAssignments, FARO_QUERY_KEYS.missionEvents]
      : [],
  })

  const query = useQuery({
    queryKey: [FARO_QUERY_KEYS.missions, 'board-live', key],
    queryFn: () => fetchBoardMissionLive(caseIds),
    enabled: caseIds.length > 0,
    staleTime: 5_000,
  })

  const byCase = useMemo(() => {
    const map: Record<string, CaseMissionLive> = {}
    for (const item of query.data ?? []) map[item.caseId] = item
    return map
  }, [query.data])

  const unseenByCase = useMemo(() => {
    const viewed = loadCaseEventsViewedAt(userId)
    const map: Record<string, number> = {}
    for (const item of query.data ?? []) {
      const relevant = item.events.filter(
        (e) =>
          [
            'volunteer_accepted',
            'volunteer_en_route',
            'volunteer_on_site',
            'volunteer_in_progress',
            'mission_completed',
            'evidence_submitted',
            'awaiting_validation',
            'eta_delay',
            'assignment_updated',
          ].includes(e.eventType) ||
          e.eventType.includes('volunteer') ||
          e.eventType.includes('mission') ||
          e.eventType.includes('eta'),
      )
      const count = countUnseenEvents(
        relevant.length ? relevant : item.events,
        viewed[item.caseId],
      )
      if (count > 0) map[item.caseId] = count
    }
    return map
    // viewedTick: recálculo al marcar vistos en localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, userId, query.dataUpdatedAt, viewedTick])

  return { byCase, unseenByCase, ...query }
}
