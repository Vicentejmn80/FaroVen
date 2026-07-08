import type { Center, Event, Need, Report } from '@/domain/models'
import { centerRepository } from '@/repositories/center-repository'
import { eventRepository } from '@/repositories/event-repository'
import { needRepository } from '@/repositories/need-repository'
import { reportRepository } from '@/repositories/report-repository'
import type {
  AdjustNeedStockInput,
  CloseNeedCycleInput,
  RegisterNeedInput,
  RegisterSiteInput,
  ReviewReportInput,
  SubmitReportInput,
  UpdateCenterInput,
  UpdateNeedInput,
  UpdateSaturationInput,
  RegisterSiteType,
} from '@/repositories/types'

export async function fetchCenters(): Promise<Center[]> {
  return centerRepository.list()
}

export async function fetchCenter(centerId: string): Promise<Center | null> {
  return centerRepository.findById(centerId)
}

export async function fetchNeeds(): Promise<Need[]> {
  return needRepository.list()
}

export async function fetchReports(): Promise<Report[]> {
  return reportRepository.list()
}

export async function fetchEvents(): Promise<Event[]> {
  return eventRepository.list()
}

export async function registerSite(input: RegisterSiteInput): Promise<Center> {
  return centerRepository.create(input)
}

export async function updateCenter(input: UpdateCenterInput): Promise<Center> {
  return centerRepository.update(input)
}

export async function registerNeed(input: RegisterNeedInput): Promise<Need> {
  return needRepository.create(input)
}

export async function adjustNeedStock(input: AdjustNeedStockInput): Promise<Need> {
  return needRepository.updateReceived(input.needId, input.qtyReceived, input.notes)
}

export async function updateNeed(input: UpdateNeedInput): Promise<Need> {
  return needRepository.update(input)
}

export async function refreshNeedCycles(): Promise<number> {
  return needRepository.refreshCycles()
}

export async function closeNeedCycle(input: CloseNeedCycleInput): Promise<Need> {
  return needRepository.closeCycle(input)
}

export async function markNeedCovered(needId: string): Promise<Need> {
  return needRepository.markCovered(needId)
}

export async function reviewReport(input: ReviewReportInput): Promise<Report> {
  return reportRepository.updateReview(input)
}

export async function fetchReportsBySite(
  siteType: RegisterSiteType,
  siteId: string,
): Promise<Report[]> {
  return reportRepository.listBySite(siteType, siteId)
}

export async function fetchEventsByCenter(
  siteType: RegisterSiteType,
  siteId: string,
): Promise<Event[]> {
  return eventRepository.listByCenter(siteType, siteId)
}

export async function updateSiteSaturation(input: UpdateSaturationInput): Promise<void> {
  return centerRepository.updateSaturation(input)
}

export async function submitReport(input: SubmitReportInput): Promise<Report> {
  return reportRepository.create(input)
}
