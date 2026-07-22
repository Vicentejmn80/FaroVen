export interface AvailabilitySlot {
  date: string
  hour: number
  available: boolean
}

export interface AvailabilityDay {
  date: string
  dayName: string
  dayNumber: number
  slots: AvailabilitySlot[]
  totalHours: number
  isToday: boolean
  isFuture: boolean
}

export interface AvailabilityWeek {
  startDate: string
  endDate: string
  days: AvailabilityDay[]
  totalHours: number
}

export interface CoverageSummary {
  userId: string
  userName: string
  weeklyHours: number
  todayHours: number
  nextAvailability: { date: string; hour: number } | null
  todaySlots: AvailabilitySlot[]
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function getWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date)
  const day = start.getDay()
  start.setDate(start.getDate() - ((day + 6) % 7))
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('es-VE', { weekday: 'short' })
}

export function buildWeekDays(startDate: Date): Array<{ date: string; dayName: string; dayNumber: number; isToday: boolean }> {
  const today = formatDateISO(new Date())
  const days: Array<{ date: string; dayName: string; dayNumber: number; isToday: boolean }> = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const dateStr = formatDateISO(d)
    days.push({
      date: dateStr,
      dayName: getDayName(d),
      dayNumber: d.getDate(),
      isToday: dateStr === today,
    })
  }

  return days
}

export function calculateDayHours(slots: AvailabilitySlot[], date: string): number {
  return slots.filter((s) => s.date === date && s.available).length
}

export function calculateWeeklyHours(slots: AvailabilitySlot[]): number {
  return slots.filter((s) => s.available).length
}

export function buildWeekFromSlots(slots: AvailabilitySlot[], referenceDate: Date = new Date()): AvailabilityWeek {
  const { start } = getWeekRange(referenceDate)
  const days = buildWeekDays(start)

  const weekDays: AvailabilityDay[] = days.map((day) => {
    const daySlots = slots.filter((s) => s.date === day.date)
    return {
      ...day,
      slots: daySlots,
      totalHours: daySlots.filter((s) => s.available).length,
      isFuture: day.date >= formatDateISO(new Date()),
    }
  })

  return {
    startDate: formatDateISO(start),
    endDate: formatDateISO(new Date(start.getTime() + 6 * 86400000)),
    days: weekDays,
    totalHours: calculateWeeklyHours(slots),
  }
}
