const STORAGE_KEY = 'faro.volunteer.impact.v1'

export interface VolunteerImpact {
  hoursCollaborated: number
  peopleHelped: number
  needsSupported: number
  centersVisited: number
  /** Meta mensual de horas para la barra de progreso */
  monthlyHoursGoal: number
}

const DEFAULT_IMPACT: VolunteerImpact = {
  hoursCollaborated: 0,
  peopleHelped: 0,
  needsSupported: 0,
  centersVisited: 0,
  monthlyHoursGoal: 20,
}

export function loadVolunteerImpact(userId?: string | null): VolunteerImpact {
  if (typeof window === 'undefined' || !userId) return { ...DEFAULT_IMPACT }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`)
    if (!raw) return { ...DEFAULT_IMPACT }
    const parsed = JSON.parse(raw) as Partial<VolunteerImpact>
    return {
      hoursCollaborated: Number(parsed.hoursCollaborated) || 0,
      peopleHelped: Number(parsed.peopleHelped) || 0,
      needsSupported: Number(parsed.needsSupported) || 0,
      centersVisited: Number(parsed.centersVisited) || 0,
      monthlyHoursGoal: Number(parsed.monthlyHoursGoal) || DEFAULT_IMPACT.monthlyHoursGoal,
    }
  } catch {
    return { ...DEFAULT_IMPACT }
  }
}

export function impactProgressPct(impact: VolunteerImpact): number {
  if (impact.monthlyHoursGoal <= 0) return 0
  return Math.min(100, Math.round((impact.hoursCollaborated / impact.monthlyHoursGoal) * 100))
}
