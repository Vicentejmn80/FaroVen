import { supabase } from '@/lib/supabase'
import { haversineDistance } from '@/hooks/useGeolocation'
import type { InventoryReservation, InventoryReservationStatus } from '@/domain/center-operations.types'
import type { InventoryReservationRow } from '@/types/supabase'
import type { RegisterSiteType } from './types'

export interface CenterRecommendation {
  centerId: string
  centerName: string
  siteType: RegisterSiteType
  address?: string
  lat: number
  lng: number
  distanceKm: number
  available: number
  unit: string
  operationalMode: string
  updatedAt: Date
}

interface CenterGeoRow {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  operational_mode: string | null
}

function mapReservationRow(row: InventoryReservationRow): InventoryReservation {
  return {
    id: row.id,
    missionId: row.mission_id,
    caseId: row.case_id,
    centerId: row.center_id,
    resourceType: row.resource_type,
    quantity: row.quantity,
    status: row.status,
    volunteerId: row.volunteer_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

async function fetchCenterGeo(centerIds: string[]): Promise<Map<string, { name: string; address?: string; lat: number; lng: number; siteType: RegisterSiteType; operationalMode: string }>> {
  const map = new Map<string, { name: string; address?: string; lat: number; lng: number; siteType: RegisterSiteType; operationalMode: string }>()
  if (centerIds.length === 0) return map

  const tables: Array<{ table: string; siteType: RegisterSiteType }> = [
    { table: 'hospitals', siteType: 'hospital' },
    { table: 'shelters', siteType: 'shelter' },
    { table: 'supply_centers', siteType: 'supply_center' },
  ]

  for (const { table, siteType } of tables) {
    const { data } = await supabase
      .from(table)
      .select('id, name, address, latitude, longitude, operational_mode')
      .in('id', centerIds)
    for (const row of (data ?? []) as CenterGeoRow[]) {
      if (row.latitude == null || row.longitude == null) continue
      map.set(row.id, {
        name: row.name,
        address: row.address ?? undefined,
        lat: row.latitude,
        lng: row.longitude,
        siteType,
        operationalMode: row.operational_mode ?? 'active',
      })
    }
  }
  return map
}

export class LogisticsRepository {
  /** Centros con stock libre (current - reserved) del recurso, ordenados por distancia/stock/modo. */
  async recommendCenters(input: {
    resourceType: string
    minQty: number
    missionLat: number
    missionLng: number
    limit?: number
  }): Promise<CenterRecommendation[]> {
    const { data, error } = await supabase
      .from('center_resources')
      .select('center_id, current_level, reserved_level, unit, updated_at')
      .eq('resource_type', input.resourceType)
    if (error) throw error

    const rows = ((data ?? []) as Array<{
      center_id: string
      current_level: number
      reserved_level: number | null
      unit: string
      updated_at: string
    }>)
      .map((row) => ({
        centerId: row.center_id,
        available: Math.max(row.current_level - (row.reserved_level ?? 0), 0),
        unit: row.unit,
        updatedAt: new Date(row.updated_at),
      }))
      .filter((row) => row.available >= input.minQty)

    if (rows.length === 0) return []

    const geo = await fetchCenterGeo(rows.map((r) => r.centerId))
    const recommendations: CenterRecommendation[] = []

    for (const row of rows) {
      const center = geo.get(row.centerId)
      if (!center) continue
      // Solo centros operativos (active / limited)
      if (center.operationalMode !== 'active' && center.operationalMode !== 'limited') continue
      const distanceKm = haversineDistance(input.missionLat, input.missionLng, center.lat, center.lng)
      recommendations.push({
        centerId: row.centerId,
        centerName: center.name,
        siteType: center.siteType,
        address: center.address,
        lat: center.lat,
        lng: center.lng,
        distanceKm: Math.round(distanceKm * 10) / 10,
        available: row.available,
        unit: row.unit,
        operationalMode: center.operationalMode,
        updatedAt: row.updatedAt,
      })
    }

    const modeScore = (mode: string) => (mode === 'active' ? 0 : 1)
    recommendations.sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm
      if (a.available !== b.available) return b.available - a.available
      if (modeScore(a.operationalMode) !== modeScore(b.operationalMode)) {
        return modeScore(a.operationalMode) - modeScore(b.operationalMode)
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })

    return recommendations.slice(0, input.limit ?? 5)
  }

  async createReservation(input: {
    missionId: string
    caseId: string
    centerId: string
    resourceType: string
    quantity: number
    volunteerId?: string
  }): Promise<InventoryReservation> {
    const { data, error } = await supabase
      .from('inventory_reservations')
      .insert({
        mission_id: input.missionId,
        case_id: input.caseId,
        center_id: input.centerId,
        resource_type: input.resourceType,
        quantity: input.quantity,
        status: 'reserved',
        volunteer_id: input.volunteerId ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapReservationRow(data as InventoryReservationRow)
  }

  async updateReservationStatus(id: string, status: InventoryReservationStatus): Promise<InventoryReservation> {
    const { data, error } = await supabase
      .from('inventory_reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return mapReservationRow(data as InventoryReservationRow)
  }

  async updateReservationStatusByMission(missionId: string, status: InventoryReservationStatus): Promise<void> {
    const { error } = await supabase
      .from('inventory_reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('mission_id', missionId)
    if (error) throw error
  }

  async findByMissionId(missionId: string): Promise<InventoryReservation | null> {
    const { data, error } = await supabase
      .from('inventory_reservations')
      .select('*')
      .eq('mission_id', missionId)
      .maybeSingle()
    if (error) throw error
    return data ? mapReservationRow(data as InventoryReservationRow) : null
  }

  async listByCenter(centerId: string, statuses?: InventoryReservationStatus[]): Promise<InventoryReservation[]> {
    let query = supabase
      .from('inventory_reservations')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false })
    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses)
    }
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as InventoryReservationRow[]).map(mapReservationRow)
  }

  async listByCase(caseId: string): Promise<InventoryReservation[]> {
    const { data, error } = await supabase
      .from('inventory_reservations')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as InventoryReservationRow[]).map(mapReservationRow)
  }
}

export const logisticsRepository = new LogisticsRepository()
