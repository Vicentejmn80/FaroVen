import type { Report } from '@/domain/models'
import { reportRepository } from '@/repositories/report-repository'
import { caseService } from './case-service'

export const autoCaseService = {
  async createFromReport(report: Report, actorId?: string) {
    const title = report.description.length > 80
      ? report.description.slice(0, 77) + '...'
      : report.description

    const result = await caseService.create({
      title,
      description: report.description,
      priority: report.confidence === 'high' ? 'high' : 'medium',
      zone: report.location.zone,
      location: {
        lat: report.location.coordinates.lat,
        lng: report.location.coordinates.lng,
        address: report.location.address,
      },
      affectedCount: 1,
      reporterInfo: {
        name: report.userId !== 'anonymous' ? report.userId : undefined,
      },
      category: report.type,
      actorId,
      reportId: report.id,
      requestSource: 'citizen',
      requestType: 'report',
      operationType: 'incident',
    })

    if (report.status !== 'converted' && report.status !== 'discarded') {
      await reportRepository.markConverted({
        id: report.id,
        caseId: result.case.id,
      })
    }

    return result
  },
}
