/** Citizen portal categories — must match `report_type` enum in Postgres. */
export const CITIZEN_REPORT_TYPES = ['need', 'damage', 'center', 'person', 'infra', 'other'] as const

export type CitizenReportType = (typeof CITIZEN_REPORT_TYPES)[number]

const CITIZEN_REPORT_TYPE_SET = new Set<string>(CITIZEN_REPORT_TYPES)

export function normalizeCitizenReportType(value?: string | null): CitizenReportType {
  const key = value?.trim().toLowerCase()
  if (key && CITIZEN_REPORT_TYPE_SET.has(key)) return key as CitizenReportType
  return 'other'
}

/** Default triage priority for citizen report categories. */
export function citizenReportPriority(type: string): 'high' | 'medium' | 'low' {
  if (type === 'person' || type === 'health') return 'high'
  if (type === 'need' || type === 'damage' || type === 'center' || type === 'shelter') return 'medium'
  return 'low'
}
