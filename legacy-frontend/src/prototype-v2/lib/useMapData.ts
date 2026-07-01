import { useMemo } from 'react'
import { useHospitals } from '@/hooks/useHospitals'
import { useSupplyCenters } from '@/hooks/useSupplyCenters'
import { useShelters } from '@/hooks/useShelters'
import { useNeedsWithLocations } from '@/hooks/useQuickUpdate'
import type { Hospital, NeedPriority, Shelter, SupplyCenter } from '@/lib/types'
import { resolveLocation, type LatLng } from './geo'

export type EntityKind = 'hospital' | 'supply_center' | 'shelter'

export interface EntityNeed {
  id: string
  item: string
  priority: NeedPriority
  pct: number
  detail: string
  updatedAt: string
}

export interface MapEntity {
  id: string
  kind: EntityKind
  name: string
  address: string | null
  phone: string | null
  schedule: string | null
  status: string
  updatedAt: string
  coords: LatLng | null
  referentialCoords: boolean
  topPriority: NeedPriority | null
  needs: EntityNeed[]
  unmetCritical: number
}

export interface MapStats {
  hospitalsActive: number
  supplyCenters: number
  shelters: number
  criticalNeeds: number
  lastUpdated: string | null
}

const PRIORITY_RANK: Record<NeedPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function maxUpdated(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

export function useMapData() {
  const hospitalsQ = useHospitals()
  const supplyQ = useSupplyCenters()
  const sheltersQ = useShelters()
  const needsQ = useNeedsWithLocations()

  const isLoading =
    hospitalsQ.isLoading || supplyQ.isLoading || sheltersQ.isLoading || needsQ.isLoading
  const error = hospitalsQ.error || supplyQ.error || sheltersQ.error || needsQ.error

  const { entities, stats } = useMemo(() => {
    const hospitals = (hospitalsQ.data ?? []) as Hospital[]
    const supply = (supplyQ.data ?? []) as SupplyCenter[]
    const shelters = (sheltersQ.data ?? []) as Shelter[]
    const needs = needsQ.data ?? []

    const needsByEntity = new Map<string, EntityNeed[]>()
    for (const need of needs) {
      const list = needsByEntity.get(need.needable_id) ?? []
      list.push({
        id: need.id,
        item: need.item_name,
        priority: need.priority,
        pct: need.pct_covered,
        detail: `${need.qty_received}/${need.qty_required} ${need.unit}`,
        updatedAt: need.updated_at,
      })
      needsByEntity.set(need.needable_id, list)
    }

    const build = (
      raw: { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; status: string; updated_at: string },
      kind: EntityKind,
      phone: string | null,
      schedule: string | null
    ): MapEntity => {
      const entityNeeds = (needsByEntity.get(raw.id) ?? []).sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      )
      const topPriority = entityNeeds.length ? entityNeeds[0].priority : null
      const unmetCritical = entityNeeds.filter(
        (n) => n.priority === 'critical' && n.pct < 100
      ).length
      const located = resolveLocation(raw.name, raw.latitude, raw.longitude)
      const latestNeed = entityNeeds.reduce<string | null>(
        (acc, n) => maxUpdated(acc, n.updatedAt),
        null
      )

      return {
        id: raw.id,
        kind,
        name: raw.name,
        address: raw.address,
        phone,
        schedule,
        status: raw.status,
        updatedAt: maxUpdated(raw.updated_at, latestNeed) ?? raw.updated_at,
        coords: located.coords,
        referentialCoords: located.referential,
        topPriority,
        needs: entityNeeds,
        unmetCritical,
      }
    }

    const all: MapEntity[] = [
      ...hospitals.map((h) => build(h, 'hospital', h.phone, null)),
      ...supply.map((c) => build(c, 'supply_center', c.contact_phone, c.schedule)),
      ...shelters.map((s) => build(s, 'shelter', s.contact_phone, null)),
    ]

    const criticalNeeds = needs.filter((n) => n.priority === 'critical').length
    const lastUpdated = all.reduce<string | null>((acc, e) => maxUpdated(acc, e.updatedAt), null)

    const computed: MapStats = {
      hospitalsActive: hospitals.length,
      supplyCenters: supply.length,
      shelters: shelters.length,
      criticalNeeds,
      lastUpdated,
    }

    return { entities: all, stats: computed }
  }, [hospitalsQ.data, supplyQ.data, sheltersQ.data, needsQ.data])

  const mapped = useMemo(() => entities.filter((e) => e.coords), [entities])
  const unlocated = useMemo(() => entities.filter((e) => !e.coords), [entities])

  return { entities, mapped, unlocated, stats, isLoading, error }
}
