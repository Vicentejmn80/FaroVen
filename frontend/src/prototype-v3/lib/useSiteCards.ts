import { useMemo } from 'react'
import { useHospitals } from '@/hooks/useHospitals'
import { useShelters } from '@/hooks/useShelters'
import { useSupplyCenters } from '@/hooks/useSupplyCenters'
import { useNeedsWithLocations } from '@/hooks/useQuickUpdate'
import { resolveLocation, type LatLng } from '@/prototype-v2/lib/geo'
import type { Hospital, NeedPriority, Shelter, SupplyCenter } from '@/lib/types'

// El prototipo v3 reorganiza la información alrededor de "¿qué hago ahora?".
// Toda la data (sitios, necesidades, saturación) proviene de Supabase a través
// de los hooks existentes; aquí solo la componemos en un modelo por tarjeta.

export type SiteKind = 'hospital' | 'shelter' | 'supply_center'
export type Severity = 'critical' | 'high' | 'medium' | 'covered'

export const KIND_LABEL: Record<SiteKind, string> = {
  hospital: 'Hospitales',
  shelter: 'Refugios',
  supply_center: 'Centros de acopio',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  covered: 'Cubierto',
}

export interface SiteCardNeed {
  id: string
  name: string
  priority: NeedPriority
  pct: number
  qtyReceived: number
  qtyRequired: number
  unit: string
  severity: Severity
  updatedAt: string
}

export interface SiteCardData {
  id: string
  kind: SiteKind
  name: string
  address: string | null
  coords: LatLng | null
  referentialCoords: boolean
  updatedAt: string
  severity: Severity
  needs: SiteCardNeed[]
  notAccepts: string[]
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, covered: 3 }

function coverageSeverity(pct: number): Severity {
  if (pct < 30) return 'critical'
  if (pct < 60) return 'high'
  if (pct < 90) return 'medium'
  return 'covered'
}

function maxUpdated(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

export function useSiteCards() {
  const hospitalsQ = useHospitals()
  const sheltersQ = useShelters()
  const supplyQ = useSupplyCenters()
  const needsQ = useNeedsWithLocations()

  const isLoading =
    hospitalsQ.isLoading || sheltersQ.isLoading || supplyQ.isLoading || needsQ.isLoading
  const error = hospitalsQ.error || sheltersQ.error || supplyQ.error || needsQ.error

  const { sites, lastUpdated } = useMemo(() => {
    const hospitals = (hospitalsQ.data ?? []) as Hospital[]
    const shelters = (sheltersQ.data ?? []) as Shelter[]
    const supply = (supplyQ.data ?? []) as SupplyCenter[]
    const needs = needsQ.data ?? []

    const needsBySite = new Map<string, SiteCardNeed[]>()
    for (const need of needs) {
      const list = needsBySite.get(need.needable_id) ?? []
      list.push({
        id: need.id,
        name: need.item_name,
        priority: need.priority,
        pct: need.pct_covered,
        qtyReceived: need.qty_received,
        qtyRequired: need.qty_required,
        unit: need.unit,
        severity: coverageSeverity(need.pct_covered),
        updatedAt: need.updated_at,
      })
      needsBySite.set(need.needable_id, list)
    }

    const build = (
      raw: { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; updated_at: string },
      kind: SiteKind,
      notAccepts: string[]
    ): SiteCardData => {
      const siteNeeds = (needsBySite.get(raw.id) ?? []).sort(
        (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      )
      const severity = siteNeeds.reduce<Severity>(
        (worst, n) => (SEVERITY_RANK[n.severity] < SEVERITY_RANK[worst] ? n.severity : worst),
        'covered'
      )
      const latestNeed = siteNeeds.reduce<string | null>((acc, n) => maxUpdated(acc, n.updatedAt), null)
      const located = resolveLocation(raw.name, raw.latitude, raw.longitude)

      return {
        id: raw.id,
        kind,
        name: raw.name,
        address: raw.address,
        coords: located.coords,
        referentialCoords: located.referential,
        updatedAt: maxUpdated(raw.updated_at, latestNeed) ?? raw.updated_at,
        severity,
        needs: siteNeeds,
        notAccepts,
      }
    }

    const all: SiteCardData[] = [
      ...hospitals.map((h) => build(h, 'hospital', [])),
      ...shelters.map((s) => build(s, 'shelter', [])),
      ...supply.map((c) => build(c, 'supply_center', c.not_accepts ?? [])),
    ]

    const last = all.reduce<string | null>((acc, s) => maxUpdated(acc, s.updatedAt), null)
    return { sites: all, lastUpdated: last }
  }, [hospitalsQ.data, sheltersQ.data, supplyQ.data, needsQ.data])

  return { sites, lastUpdated, isLoading, error }
}

export { coverageSeverity, SEVERITY_RANK }
