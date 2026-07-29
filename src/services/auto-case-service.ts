import type { Report } from '@/domain/models'
import { supabase } from '@/lib/supabase'
import { caseService } from './case-service'
import { citizenReportPriority } from '@/lib/report-types'

/**
 * Ingesta automática: el reporte ciudadano crea un caso en NUEVO.
 * No marca el reporte como convertido — el GC completa la conversión / publicación.
 */
export const autoCaseService = {
  async intakeFromReport(report: Report, actorId?: string) {
    const existingId = await findOpenCaseForReport(report.id)
    if (existingId) {
      const existing = await caseService.getById(existingId)
      if (existing) return { case: existing, event: null as null, reused: true as const }
    }

    const title =
      report.description.length > 80
        ? report.description.slice(0, 77) + '...'
        : report.description || 'Reporte ciudadano'

    const contact = parseContactInfo(report.contactInfo ?? report.source)
    const lat = report.location.coordinates.lat
    const lng = report.location.coordinates.lng
    const hasCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0)

    const result = await caseService.create({
      title,
      description: report.description,
      priority: citizenReportPriority(report.type),
      zone: report.location.zone || 'Zona por confirmar',
      location: hasCoords
        ? {
            lat,
            lng,
            address: report.location.address,
          }
        : undefined,
      affectedCount: 1,
      reporterInfo: {
        name: contact.name ?? (report.userId !== 'anonymous' ? report.userId : undefined),
        phone: contact.phone,
        email: contact.email,
      },
      category: report.type,
      actorId,
      reportId: report.id,
      requestSource: 'citizen',
      requestType: 'report',
      operationType: 'incident',
    })

    return { ...result, reused: false as const }
  },

  /** Compat: aprobación de coordinador — ingesta + deja en nuevo si aún no existe. */
  async createFromReport(report: Report, actorId?: string) {
    return this.intakeFromReport(report, actorId)
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

function parseContactInfo(raw?: string): { name?: string; phone?: string; email?: string } {
  if (!raw?.trim()) return {}
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean)
  const result: { name?: string; phone?: string; email?: string } = {}
  for (const part of parts) {
    if (part.includes('@') && !result.email) result.email = part
    else if (/[\d+]{7,}/.test(part.replace(/[\s()-]/g, '')) && !result.phone) result.phone = part
    else if (!result.name) result.name = part
  }
  return result
}
