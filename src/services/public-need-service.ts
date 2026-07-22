import type {
  CoverageReservation,
  NeedTimeline,
  NeedVerification,
  PublicNeed,
  SuccessCase,
} from '@/domain/public-need.types'
import { publicNeedRepository } from '@/repositories/public-need-repository'

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
  return publicNeedRepository.verifyEntry(input)
}

export async function reserveNeedCoverage(input: {
  publicNeedId: string
  collaboratorName?: string
  collaboratorType?: CoverageReservation['collaboratorType']
  quantity: number
}): Promise<CoverageReservation> {
  return publicNeedRepository.createCoverageReservation(input)
}

export async function updateNeedReservationStatus(input: {
  reservationId: string
  status: CoverageReservation['status']
}): Promise<CoverageReservation> {
  return publicNeedRepository.updateReservationStatus(input)
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

