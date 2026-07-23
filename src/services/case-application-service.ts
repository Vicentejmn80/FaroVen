import { caseApplicationRepository } from '@/repositories/case-application-repository'
import { caseService } from '@/services/case-service'
import type { CaseApplicationWithApplicant } from '@/domain/case-application.types'

export const caseApplicationService = {
  async listByCase(caseId: string): Promise<CaseApplicationWithApplicant[]> {
    return caseApplicationRepository.listByCase(caseId)
  },

  async apply(caseId: string, applicantId: string, params?: {
    organization?: string
    message?: string
    skills?: string[]
    availability?: string
  }) {
    return caseApplicationRepository.apply(caseId, applicantId, params)
  },

  async approve(applicationId: string, operatorId: string) {
    const app = await caseApplicationRepository.findById(applicationId)
    if (!app) throw new Error('Postulación no encontrada')

    await caseApplicationRepository.updateStatus(applicationId, 'approved')

    await caseService.transition(app.caseId, 'assigned', operatorId, `Postulación aprobada — ${app.organization || 'voluntario/a'} asignado al caso`)
  },

  async reject(applicationId: string, operatorId: string) {
    const app = await caseApplicationRepository.findById(applicationId)
    if (!app) throw new Error('Postulación no encontrada')

    await caseApplicationRepository.updateStatus(applicationId, 'rejected')

    await caseService.transition(app.caseId, 'open_for_applications', operatorId, 'Postulación rechazada — el caso sigue abierto a otras postulaciones')
  },
}
