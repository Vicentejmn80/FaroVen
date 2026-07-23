import type {
  CoverageInterest,
  CoverageReservation,
  NeedTimeline,
  NeedVerification,
  PublicNeed,
  SuccessCase,
} from '@/domain/public-need.types'
import { missionService } from '@/services/mission-service'
import { volunteerRepository } from '@/repositories/volunteer-repository'
import { supabase } from '@/lib/supabase'
import { notifyUser } from '@/lib/notify'
import { operationalIntelligenceService } from '@/services/operational-intelligence-service'
import { publicNeedRepository } from '@/repositories/public-need-repository'

function toFiniteNumber(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function fetchPublicNeeds(): Promise<PublicNeed[]> {
  return publicNeedRepository.listActivePublic()
}

export async function fetchOperationalPublicNeeds(): Promise<PublicNeed[]> {
  return publicNeedRepository.listOperational()
}

export async function createPublicNeedFromReport(input: {
  reportId: string | null
  caseId?: string | null
  title: string
  summary: string
  category: string
  priority: PublicNeed['priority']
  locationPublic: PublicNeed['locationPublic']
  requiredQuantity: number
  unit: string
  expiresAt?: string | null
}): Promise<PublicNeed> {
  return publicNeedRepository.createFromReport(input)
}

export async function verifyPublicNeedEntry(input: {
  publicNeedId: string
  checklist: string[]
  decision: 'approved' | 'rejected' | 'needs_info'
  notes?: string
  actorId: string
}): Promise<PublicNeed> {
  const updated = await publicNeedRepository.verifyEntry(input)

  if (input.decision === 'approved') {
    const { data: recipients } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['volunteer', 'coordinator', 'case_manager', 'regional_admin', 'super_admin'])
      .eq('status', 'active')

    await Promise.all(
      (recipients ?? []).map((recipient) =>
        notifyUser(
          String(recipient.id),
          'Nueva necesidad pública',
          `${updated.title} está disponible para cobertura.`,
          {
            type: 'public_need_published',
            publicNeedId: updated.id,
            priority: updated.priority,
          },
        ),
      ),
    )

    await operationalIntelligenceService.emitTimelineEvent({
      type: 'event',
      title: 'Necesidad publicada',
      description: 'Una necesidad pública quedó visible para toda la red FARO',
      severity: updated.priority === 'critical' ? 'critical' : 'info',
      entityId: updated.id,
      metadata: {
        event_kind: 'public_need_published',
        public_need_id: updated.id,
        priority: updated.priority,
      },
    })
  }

  return updated
}

export async function reserveNeedCoverage(input: {
  publicNeedId: string
  collaboratorName?: string
  collaboratorType?: CoverageReservation['collaboratorType']
  quantity: number
}): Promise<CoverageReservation> {
  const reservation = await publicNeedRepository.createCoverageReservation(input)

  const { data: operators } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['case_manager', 'coordinator', 'regional_admin', 'super_admin'])
    .eq('status', 'active')

  await Promise.all(
    (operators ?? []).map((operator) =>
      notifyUser(
        String(operator.id),
        'Nueva postulación de cobertura',
        `Hay un nuevo interesado para cubrir una necesidad pública.`,
        {
          type: 'coverage_interest_submitted',
          publicNeedId: input.publicNeedId,
          reservationId: reservation.id,
          collaboratorType: reservation.collaboratorType,
        },
      ),
    ),
  )

  await operationalIntelligenceService.emitTimelineEvent({
    type: 'event',
    title: 'Nueva postulación de cobertura',
    description: 'Se registró un nuevo interesado en una necesidad pública',
    severity: 'info',
    entityId: input.publicNeedId,
    metadata: {
      event_kind: 'coverage_interest_submitted',
      reservation_id: reservation.id,
      collaborator_type: reservation.collaboratorType,
      public_need_id: input.publicNeedId,
    },
  })

  return reservation
}

export async function updateNeedReservationStatus(input: {
  reservationId: string
  status: CoverageReservation['status']
}): Promise<CoverageReservation> {
  return publicNeedRepository.updateReservationStatus(input)
}

export async function fetchNeedInterests(publicNeedId: string): Promise<CoverageInterest[]> {
  const [need, reservations] = await Promise.all([
    publicNeedRepository.findById(publicNeedId),
    publicNeedRepository.listCoverageReservationsByNeed(publicNeedId),
  ])
  if (!need) return []

  const needsLat = toFiniteNumber(need.locationPublic.lat)
  const needsLng = toFiniteNumber(need.locationPublic.lng)

  const enriched = await Promise.all(
    reservations.map(async (reservation) => {
      const collaboratorUserId = reservation.collaboratorUserId
      if (!collaboratorUserId || reservation.collaboratorType !== 'volunteer') {
        return reservation as CoverageInterest
      }

      const volunteer = await volunteerRepository.findByUserId(collaboratorUserId)
      if (!volunteer) return reservation as CoverageInterest

      const distanceKm =
        needsLat != null && needsLng != null
          ? haversineKm(needsLat, needsLng, volunteer.lat, volunteer.lng)
          : undefined

      return {
        ...reservation,
        collaboratorName: reservation.collaboratorName ?? volunteer.fullName,
        volunteerId: volunteer.id,
        volunteerAvailability: volunteer.availability,
        volunteerExperience: volunteer.experience,
        volunteerAvgResponseMinutes: volunteer.avgResponseMinutes,
        volunteerCompletedMissions: volunteer.completedMissions,
        volunteerServiceHours: volunteer.serviceHours,
        distanceKm,
      } satisfies CoverageInterest
    }),
  )

  return enriched
}

export async function approveNeedInterest(input: {
  reservationId: string
  operatorId: string
}): Promise<{ reservation: CoverageReservation; missionId?: string; assignmentId?: string }> {
  const reservation = await publicNeedRepository.findCoverageReservationById(input.reservationId)
  if (!reservation) throw new Error('Postulación no encontrada')
  if (reservation.status !== 'reserved') {
    throw new Error('Solo se pueden aprobar postulaciones pendientes')
  }

  const need = await publicNeedRepository.findById(reservation.publicNeedId)
  if (!need) throw new Error('Necesidad pública no encontrada')

  let missionId: string | undefined
  let assignmentId: string | undefined

  if (reservation.collaboratorType === 'volunteer' && reservation.collaboratorUserId) {
    const volunteer = await volunteerRepository.findByUserId(reservation.collaboratorUserId)
    if (!volunteer) throw new Error('No se encontró el perfil de voluntario para esta postulación')

    const missionCreation = await missionService.create({
      centerId: 'network_pool',
      title: need.title,
      description: need.summary || `Cobertura operativa para ${need.category}`,
      priority: need.priority,
      requiredSkills: volunteer.skills ?? [],
      requiredPeople: 1,
      location: {
        lat: toFiniteNumber(need.locationPublic.lat) ?? 0,
        lng: toFiniteNumber(need.locationPublic.lng) ?? 0,
        address: need.locationPublic.address,
        zone: need.locationPublic.zone,
      },
      supportRequestId: need.id,
      caseId: need.caseId ?? undefined,
      createdBy: input.operatorId,
    })

    missionId = missionCreation.mission.id
    const assignment = await missionService.assignVolunteer(missionId, volunteer.id, input.operatorId)
    assignmentId = assignment.id

    await notifyUser(
      reservation.collaboratorUserId,
      'Postulación aprobada',
      `Tu postulación fue aprobada y se creó una misión operativa.`,
      {
        type: 'coverage_interest_approved',
        reservationId: reservation.id,
        publicNeedId: reservation.publicNeedId,
        missionId,
        assignmentId,
      },
    )
  } else if (reservation.collaboratorUserId) {
    await notifyUser(
      reservation.collaboratorUserId,
      'Postulación aprobada',
      `Tu postulación fue aprobada por el gestor.`,
      {
        type: 'coverage_interest_approved',
        reservationId: reservation.id,
        publicNeedId: reservation.publicNeedId,
      },
    )
  }

  const confirmed = await publicNeedRepository.updateReservationStatus({
    reservationId: reservation.id,
    status: 'confirmed',
  })

  await operationalIntelligenceService.emitTimelineEvent({
    type: 'event',
    title: 'Postulación aprobada',
    description: missionId
      ? 'El gestor aprobó la postulación y se creó una misión'
      : 'El gestor aprobó la postulación de cobertura',
    severity: 'info',
    entityId: reservation.publicNeedId,
    metadata: {
      event_kind: 'coverage_interest_approved',
      reservation_id: reservation.id,
      public_need_id: reservation.publicNeedId,
      operator_id: input.operatorId,
      mission_id: missionId ?? null,
      assignment_id: assignmentId ?? null,
    },
  })

  return { reservation: confirmed, missionId, assignmentId }
}

export async function rejectNeedInterest(input: {
  reservationId: string
  operatorId: string
}): Promise<CoverageReservation> {
  const reservation = await publicNeedRepository.findCoverageReservationById(input.reservationId)
  if (!reservation) throw new Error('Postulación no encontrada')
  if (reservation.status !== 'reserved') {
    throw new Error('Solo se pueden rechazar postulaciones pendientes')
  }

  const rejected = await publicNeedRepository.updateReservationStatus({
    reservationId: reservation.id,
    status: 'cancelled',
  })

  if (reservation.collaboratorUserId) {
    await notifyUser(
      reservation.collaboratorUserId,
      'Postulación no aprobada',
      'Tu postulación no fue aprobada en esta ocasión.',
      {
        type: 'coverage_interest_rejected',
        reservationId: reservation.id,
        publicNeedId: reservation.publicNeedId,
      },
    )
  }

  await operationalIntelligenceService.emitTimelineEvent({
    type: 'event',
    title: 'Postulación rechazada',
    description: 'El gestor rechazó una postulación de cobertura',
    severity: 'warning',
    entityId: reservation.publicNeedId,
    metadata: {
      event_kind: 'coverage_interest_rejected',
      reservation_id: reservation.id,
      public_need_id: reservation.publicNeedId,
      operator_id: input.operatorId,
    },
  })

  return rejected
}

export async function fetchNeedTimeline(publicNeedId: string): Promise<NeedTimeline[]> {
  return publicNeedRepository.listNeedTimeline(publicNeedId)
}

export async function fetchNeedVerifications(publicNeedId: string): Promise<NeedVerification[]> {
  return publicNeedRepository.listNeedVerifications(publicNeedId)
}

export async function fetchSuccessCases(limit = 20): Promise<SuccessCase[]> {
  return publicNeedRepository.listSuccessCases(limit)
}

