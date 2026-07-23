import { supabase } from '@/lib/supabase'
import { caseApplicationRepository } from '@/repositories/case-application-repository'
import { caseService } from '@/services/case-service'
import { missionService } from '@/services/mission-service'
import { notifyUser } from '@/lib/notify'
import type { CaseApplicationWithApplicant } from '@/domain/case-application.types'
import type { CaseDomain } from '@/domain/case-lifecycle.types'

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
    const app = await caseApplicationRepository.apply(caseId, applicantId, params)
    const caseData = await caseService.getById(caseId)
    if (caseData) {
      const managers = await getActiveManagers()
      for (const m of managers) {
        await notifyUser(
          m.id,
          'Nuevo postulante',
          `Un voluntario se postuló al caso "${caseData.title}"`,
          { caseId, applicationId: app.id, type: 'case_application' },
        )
      }
    }
    return app
  },

  async notifyVolunteersAboutCase(caseData: CaseDomain) {
    const volunteers = await getActiveVolunteersNear(caseData.location.lat, caseData.location.lng, 25)
    for (const v of volunteers) {
      await notifyUser(
        v.userId,
        'Nuevo caso cerca de ti',
        `Se abrió "${caseData.title}" en ${caseData.zone} — ¿quieres postularte?`,
        { caseId: caseData.id, type: 'case_open', lat: caseData.location.lat, lng: caseData.location.lng, zone: caseData.zone },
      )
    }
  },

  async approve(applicationId: string, operatorId: string) {
    const app = await caseApplicationRepository.findById(applicationId)
    if (!app) throw new Error('Postulación no encontrada')

    await caseApplicationRepository.updateStatus(applicationId, 'approved')

    const caseData = await caseService.getById(app.caseId)
    if (!caseData) throw new Error('Caso no encontrado')

    await caseService.transition(app.caseId, 'assigned', operatorId, `Postulación aprobada — voluntario asignado al caso`)

    // Create mission linked to case and assign the approved volunteer
    const created = await missionService.create({
      centerId: 'volunteer_pool',
      title: caseData.title,
      description: caseData.description,
      priority: caseData.priority,
      requiredSkills: app.skills ?? [],
      requiredPeople: 1,
      location: { lat: caseData.location.lat, lng: caseData.location.lng, zone: caseData.zone },
      caseId: app.caseId,
      createdBy: operatorId,
    })

    await missionService.assignVolunteer(created.mission.id, app.applicantId, operatorId)

    const applicant = await getProfileName(app.applicantId)
    if (applicant) {
      await notifyUser(app.applicantId, 'Postulación aprobada', `Fuiste asignado a "${caseData.title}". Revisa tus misiones activas.`, { caseId: app.caseId, missionId: created.mission.id, type: 'case_approved' })
    }
  },

  async reject(applicationId: string, operatorId: string) {
    const app = await caseApplicationRepository.findById(applicationId)
    if (!app) throw new Error('Postulación no encontrada')

    await caseApplicationRepository.updateStatus(applicationId, 'rejected')

    await caseService.transition(app.caseId, 'open_for_applications', operatorId, 'Postulación rechazada — el caso sigue abierto a otras postulaciones')

    const applicant = await getProfileName(app.applicantId)
    if (applicant) {
      await notifyUser(app.applicantId, 'Postulación rechazada', 'Tu postulación fue rechazada. El caso sigue abierto a otros voluntarios.', { caseId: app.caseId, type: 'case_rejected' })
    }
  },
}

async function getActiveVolunteersNear(lat: number, lng: number, radiusKm: number) {
  try {
    const { data } = await supabase.rpc('get_volunteers_near_location', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
    })
    return (data ?? []) as { userId: string; fullName: string; phone?: string; distanceKm: number }[]
  } catch {
    return []
  }
}

async function getActiveManagers() {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['case_manager', 'coordinator', 'regional_admin', 'super_admin'])
    return (data ?? []) as { id: string }[]
  } catch {
    return []
  }
}

async function getProfileName(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    return data?.full_name ?? null
  } catch {
    return null
  }
}
