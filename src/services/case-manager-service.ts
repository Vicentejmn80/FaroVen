import { reportRepository } from '@/repositories/report-repository'
import { publicNeedRepository } from '@/repositories/public-need-repository'
import { caseRepository } from '@/repositories/case-repository'
import { caseService } from './case-service'
import { caseApplicationService } from './case-application-service'
import { openNeedCall } from './public-need-service'
import type { Report } from '@/domain/models'
import type { CaseDomain, CasePriority } from '@/domain/case-lifecycle.types'
import type { PublicNeed } from '@/domain/public-need.types'
import { supabase } from '@/lib/supabase'
import { missionLog } from '@/lib/operational-log'

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
    if (!report) throw new Error('Reporte no encontrado')

    if (report.status === 'converted' || report.status === 'discarded') {
      throw new Error('Este reporte ya fue procesado y no puede convertirse de nuevo.')
    }

    const lat = report.location.coordinates.lat ?? 0
    const lng = report.location.coordinates.lng ?? 0
    const hasValidCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180

    if (!hasValidCoords) {
      throw new Error(
        'Este reporte no tiene GPS válido. Pide al ciudadano reenviarlo con ubicación, o marca el punto antes de convertir.',
      )
    }

    // Evitar duplicados: si el reporte ya ingresó a Nuevo, enriquecer y abrir revisión
    const existingCaseId = await findOpenCaseForReport(data.reportId)
    if (existingCaseId) {
      await reportRepository.markConverted({ id: data.reportId, caseId: existingCaseId })
      const existing = await caseService.getById(existingCaseId)
      if (!existing) throw new Error('Caso existente no encontrado')

      await caseRepository.update(existingCaseId, {
        title: data.title,
        description: data.description,
        priority: data.priority,
        zone: data.zone,
        category: data.category,
        affectedCount: data.affectedCount,
        location: {
          lat,
          lng,
          address: report.location.address,
        },
        reporterInfo: {
          name: data.reporterName ?? undefined,
          phone: data.reporterPhone ?? undefined,
          email: data.reporterEmail ?? undefined,
        },
      })

      const reviewed =
        existing.pipelineStage === 'nuevo'
          ? await caseService.startReview(existingCaseId, actorId)
          : {
              case: { ...existing, title: data.title, description: data.description },
              event: {
                id: crypto.randomUUID(),
                caseId: existing.id,
                eventType: 'case_review_started' as const,
                toStage: existing.pipelineStage,
                actorId,
                createdAt: new Date(),
              },
            }

      const needs = await publicNeedRepository.listByCaseId(reviewed.case.id)
      if (needs.length === 0) {
        await publicNeedRepository.createFromCase({
          caseId: reviewed.case.id,
          title: data.title,
          summary: data.description,
          category: data.category,
          priority: data.priority,
          zone: data.zone,
          location: {
            lat,
            lng,
            address: report.location.address,
            zone: data.zone,
          },
          actorId,
        })
      }

      return reviewed
    }

    const result = await caseService.create({
      title: data.title,
      description: data.description,
      priority: data.priority,
      zone: data.zone,
      category: data.category,
      affectedCount: data.affectedCount,
      location: {
        lat,
        lng,
        address: report.location.address,
      },
      reporterInfo: {
        name: data.reporterName ?? undefined,
        phone: data.reporterPhone ?? undefined,
        email: data.reporterEmail ?? undefined,
      },
      actorId,
      reportId: data.reportId,
      requestSource: 'citizen',
      requestType: 'report',
      operationType: 'incident',
    })

    // Marcar convertido apenas existe el caso — sobrevive fallos posteriores
    // (p.ej. transición redundante en casos critical que ya están en pending_review).
    await reportRepository.markConverted({
      id: data.reportId,
      caseId: result.case.id,
    })

    const transitioned = result

    // Necesidad borrador (convocatoria cerrada). El gestor abre voluntarios después.
    await publicNeedRepository.createFromCase({
      caseId: transitioned.case.id,
      title: data.title,
      summary: data.description,
      category: data.category,
      priority: data.priority,
      zone: data.zone,
      location: {
        lat,
        lng,
        address: report.location.address,
        zone: data.zone,
      },
      actorId,
    })

    return transitioned
  },

  /**
   * Abre la convocatoria operativa de un caso:
   * caso → open_for_applications, necesidad visible, call_status=open, avisos a voluntarios.
   */
  async openVolunteerCall(
    caseId: string,
    actorId?: string,
    options?: { skipDecisionLog?: boolean },
  ): Promise<{
    case: CaseDomain
    need: PublicNeed
  }> {
    const caseData = await caseService.getById(caseId)
    if (!caseData) throw new Error('Caso no encontrado')

    const { assertCaseReadyForRadar } = await import('@/domain/case-publish-validation')
    assertCaseReadyForRadar(caseData, actorId)

    if (!caseData.category) {
      await caseService.updateClassification(caseId, {
        category: caseData.title.slice(0, 80) || 'apoyo',
      })
    }

    if (!options?.skipDecisionLog) {
      const { pipelineLog } = await import('@/lib/operational-log')
      pipelineLog('gc_decision', {
        entityId: caseId,
        actorId,
        from: caseData.pipelineStage,
        to: 'open_for_applications',
        payload: { decision: 'radar', operationType: caseData.operationType },
      })
    }
    let opened = caseData
    if (caseData.pipelineStage !== 'open_for_applications') {
      const result = await caseService.transition(
        caseId,
        'open_for_applications',
        actorId,
        'Convocatoria abierta — solicitando apoyo voluntario',
      )
      opened = result.case
    }

    const existing = await publicNeedRepository.listByCaseId(caseId)
    let need =
      existing.find((n) => n.status !== 'archived' && n.status !== 'expired' && n.status !== 'closed') ??
      existing[0]

    if (!need) {
      need = await publicNeedRepository.createFromCase({
        caseId,
        title: opened.title,
        summary: opened.description,
        category: opened.category ?? 'humanitarian',
        priority: opened.priority,
        zone: opened.zone,
        location: {
          lat: opened.location.lat,
          lng: opened.location.lng,
          address: opened.location.address,
          zone: opened.zone,
        },
        actorId,
      })
    }

    if (need.callStatus !== 'open') {
      need = await openNeedCall({
        publicNeedId: need.id,
        operatorId: actorId ?? 'system',
      })
    } else {
      await caseApplicationService.notifyVolunteersAboutCase(opened)
    }

    missionLog('waiting_for_applications', {
      entityId: caseId,
      entityType: 'case',
      actorId,
      to: 'open_for_applications',
      payload: { publicNeedId: need.id, callStatus: need.callStatus },
    })

    return { case: opened, need }
  },

  /**
   * Confirma transferencia asistida por inventario.
   * - volunteer → operation_type=transfer + abrir radar
   * - institution → operation_type=transfer (GC sigue con asignar centro)
   * - node → operation_type=transfer + awaiting_center_confirmation al nodo origen
   */
  async confirmTransferDecision(params: {
    caseId: string
    actorId: string
    executor: 'volunteer' | 'institution' | 'node'
    originCenterId: string
    resourceType: string
  }): Promise<{ case: CaseDomain; next: 'radar' | 'assign_institution' | 'awaiting_node' }> {
    const { pipelineLog } = await import('@/lib/operational-log')
    const { assertCaseDomainReadyToPublish } = await import('@/domain/case-publish-validation')
    const { assignmentService } = await import('@/services/assignment-service')

    const caseData = await caseService.getById(params.caseId)
    if (!caseData) throw new Error('Caso no encontrado')
    assertCaseDomainReadyToPublish(caseData, params.actorId)

    await caseService.updateClassification(params.caseId, { operationType: 'transfer' })

    // Persistir origen de la transferencia para usarlo al aprobar la postulación.
    await caseRepository.update(params.caseId, {
      metadata: {
        ...(caseData.metadata ?? {}),
        logistics: {
          originCenterId: params.originCenterId,
          resourceType: params.resourceType,
          quantity: Math.max(1, caseData.affectedCount || 1),
          executor: params.executor,
        },
      },
    })
    pipelineLog('gc_decision', {
      entityId: params.caseId,
      actorId: params.actorId,
      from: caseData.pipelineStage,
      to: 'transfer',
      centerId: params.originCenterId,
      payload: {
        decision: 'transfer',
        executor: params.executor,
        originCenterId: params.originCenterId,
        resourceType: params.resourceType,
      },
    })

    if (params.executor === 'volunteer') {
      const result = await caseManagerService.openVolunteerCall(params.caseId, params.actorId, {
        skipDecisionLog: true,
      })
      return { case: result.case, next: 'radar' }
    }

    if (params.executor === 'node') {
      await assignmentService.assign(
        params.caseId,
        params.originCenterId,
        params.actorId,
        undefined,
        `Transferencia de inventario (${params.resourceType}) desde nodo`,
      )
      const updated = await caseService.getById(params.caseId)
      return { case: updated ?? caseData, next: 'awaiting_node' }
    }

    // institution: GC continúa con modal de asignación
    return { case: { ...caseData, operationType: 'transfer' }, next: 'assign_institution' }
  },
}

async function findOpenCaseForReport(reportId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('cases')
      .select('id')
      .contains('metadata', { report_id: reportId })
      .not('pipeline_stage', 'in', '("archived","resolved")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as { id: string } | null)?.id ?? null
  } catch {
    return null
  }
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
