import { reportRepository } from '@/repositories/report-repository'
import { caseService } from './case-service'
import { publicNeedRepository } from '@/repositories/public-need-repository'
import type { Report } from '@/domain/models'
import type { CasePriority } from '@/domain/case-lifecycle.types'
import { supabase } from '@/lib/supabase'

const EARTH_RADIUS_KM = 6371

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface NearbyCenter {
  id: string
  name: string
  type: string
  distance: number
  address?: string
  phone?: string
  capacity?: number
  currentOcc?: number
}

export interface DuplicateReport {
  id: string
  description: string
  status: string
  createdAt: Date
  distance: number
  score: number
}

export interface ReportAnalysis {
  report: Report
  duplicates: DuplicateReport[]
  nearbyCenters: NearbyCenter[]
}

export interface ConvertReportWizardData {
  reportId: string
  title: string
  description: string
  priority: CasePriority
  category: string
  zone: string
  affectedCount: number
  selectedCenterId?: string
  selectedCenterName?: string
  reporterName?: string
  reporterPhone?: string
  reporterEmail?: string
}

export const caseManagerService = {
  async analyzeReport(reportId: string): Promise<ReportAnalysis> {
    const reports = await reportRepository.list()
    const report = reports.find((r) => r.id === reportId)
    if (!report) throw new Error('Reporte no encontrado')

    const duplicates: DuplicateReport[] = []
    const lat = report.location.coordinates.lat
    const lng = report.location.coordinates.lng

    for (const other of reports) {
      if (other.id === reportId) continue
      if (other.status === 'discarded') continue

      const dLat = other.location.coordinates.lat
      const dLng = other.location.coordinates.lng
      if (!dLat || !dLng) continue

      const distance = haversineDistance(lat, lng, dLat, dLng)
      if (distance > 5) continue

      const descSimilarity = descriptionSimilarity(report.description, other.description)
      if (descSimilarity > 0.3 || distance < 0.5) {
        duplicates.push({
          id: other.id,
          description: other.description,
          status: other.status,
          createdAt: other.createdAt,
          distance: Math.round(distance * 100) / 100,
          score: Math.round((descSimilarity + Math.max(0, 1 - distance / 5)) * 50),
        })
      }
    }

    duplicates.sort((a, b) => b.score - a.score)

    const nearbyCenters = await this.findNearbyCenters(lat, lng, 10)

    return { report, duplicates, nearbyCenters }
  },

  async findNearbyCenters(lat: number, lng: number, radiusKm: number): Promise<NearbyCenter[]> {
    const centers: NearbyCenter[] = []

    const { data: hospitals } = await supabase.from('hospitals').select('*').limit(50)
    for (const h of (hospitals ?? [])) {
      if (!h.latitude || !h.longitude) continue
      const d = haversineDistance(lat, lng, h.latitude, h.longitude)
      if (d <= radiusKm) {
        centers.push({ id: h.id, name: h.name, type: 'hospital', distance: Math.round(d * 10) / 10, address: h.address ?? undefined, phone: h.phone ?? undefined, capacity: h.capacity ?? undefined, currentOcc: h.current_occ ?? undefined })
      }
    }

    const { data: shelters } = await supabase.from('shelters').select('*').limit(50)
    for (const s of (shelters ?? [])) {
      if (!s.latitude || !s.longitude) continue
      const d = haversineDistance(lat, lng, s.latitude, s.longitude)
      if (d <= radiusKm) {
        centers.push({ id: s.id, name: s.name, type: 'shelter', distance: Math.round(d * 10) / 10, address: s.address ?? undefined, phone: s.contact_phone ?? undefined, capacity: s.capacity ?? undefined, currentOcc: s.current_occ ?? undefined })
      }
    }

    const { data: supplyCenters } = await supabase.from('supply_centers').select('*').limit(50)
    for (const sc of (supplyCenters ?? [])) {
      if (!sc.latitude || !sc.longitude) continue
      const d = haversineDistance(lat, lng, sc.latitude, sc.longitude)
      if (d <= radiusKm) {
        centers.push({ id: sc.id, name: sc.name, type: 'supply_center', distance: Math.round(d * 10) / 10, address: sc.address ?? undefined, phone: sc.contact_phone ?? undefined })
      }
    }

    centers.sort((a, b) => a.distance - b.distance)
    return centers.slice(0, 10)
  },

  async convertReportToCase(data: ConvertReportWizardData, actorId?: string) {
    const report = data.reportId ? await reportRepository.findWithAnalysis(data.reportId) : null

    const result = await caseService.create({
      title: data.title,
      description: data.description,
      priority: data.priority,
      zone: data.zone,
      category: data.category,
      affectedCount: data.affectedCount,
      location: {
        lat: report?.location.coordinates.lat ?? 0,
        lng: report?.location.coordinates.lng ?? 0,
      },
      reporterInfo: {
        name: data.reporterName ?? undefined,
        phone: data.reporterPhone ?? undefined,
        email: data.reporterEmail ?? undefined,
      },
      actorId,
    })

    const transitioned = await caseService.transition(result.case.id, 'pending_review', actorId, 'Caso abierto desde reporte ciudadano — pasa a revisión')

    await publicNeedRepository.createFromCase({
      caseId: transitioned.case.id,
      title: data.title,
      summary: data.description,
      category: data.category,
      priority: data.priority,
      zone: data.zone,
      location: {
        lat: report?.location.coordinates.lat,
        lng: report?.location.coordinates.lng,
        address: report?.location.address,
        zone: data.zone,
      },
      actorId,
    })

    return transitioned
  },
}

function descriptionSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let common = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) common++
  }
  return common / Math.max(wordsA.size, wordsB.size)
}
