import { availabilityRepository } from '@/repositories/availability-repository'
import {
  getWeekRange,
  formatDateISO,
  buildWeekFromSlots,
  type AvailabilitySlot,
  type AvailabilityWeek,
  type CoverageSummary,
} from '@/domain/availability.types'
import { validateSlot, canModifySlot } from '@/domain/availability.service'

export const availabilityService = {
  async loadWeek(userId: string, referenceDate: Date = new Date()): Promise<AvailabilityWeek> {
    const { start, end } = getWeekRange(referenceDate)
    const startStr = formatDateISO(start)
    const endStr = formatDateISO(end)

    const slots = await availabilityRepository.loadWeek(userId, startStr, endStr)
    return buildWeekFromSlots(slots, referenceDate)
  },

  async toggleSlot(userId: string, date: string, hour: number): Promise<boolean> {
    const slot: AvailabilitySlot = { date, hour, available: true }
    const validation = validateSlot(slot)
    if (validation) throw new Error(validation)

    if (!canModifySlot(slot)) {
      throw new Error('No puedes modificar disponibilidad pasada')
    }

    return availabilityRepository.toggleSlot(userId, date, hour)
  },

  async setSlot(userId: string, date: string, hour: number, available: boolean): Promise<void> {
    const slot: AvailabilitySlot = { date, hour, available }
    const validation = validateSlot(slot)
    if (validation) throw new Error(validation)

    if (!canModifySlot(slot)) {
      throw new Error('No puedes modificar disponibilidad pasada')
    }

    await availabilityRepository.upsertSlot(userId, date, hour, available)
  },

  async getCoverageSummary(userId: string, userName: string): Promise<CoverageSummary> {
    const week = await this.loadWeek(userId)
    const today = formatDateISO(new Date())
    const todayDay = week.days.find((d) => d.date === today)
    const todaySlots = todayDay?.slots ?? []
    const availableToday = todaySlots.filter((s) => s.available)

    const futureSlots = week.days
      .flatMap((d) => d.slots)
      .filter((s) => s.available && s.date >= today)

    const nextAvailable = futureSlots.length > 0 ? futureSlots[0] : null

    return {
      userId,
      userName,
      weeklyHours: week.totalHours,
      todayHours: availableToday.length,
      nextAvailability: nextAvailable ? { date: nextAvailable.date, hour: nextAvailable.hour } : null,
      todaySlots: availableToday,
    }
  },
}
