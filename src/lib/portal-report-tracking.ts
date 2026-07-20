/** Seguimiento local de reportes públicos (mock hasta conectar backend). */

export type PortalReportStatus = 'Recibido' | 'En revisión' | 'Asignado a un centro' | 'Resuelto'

export interface PortalTrackedReport {
  code: string
  description: string
  contactPhone?: string
  contactEmail?: string
  contactName?: string
  status: PortalReportStatus
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'faro:portal-reports'

function readAll(): PortalTrackedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PortalTrackedReport[]
  } catch {
    return []
  }
}

function writeAll(reports: PortalTrackedReport[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

/** Genera código tipo FARO-2026-A3K9 */
export function generateTrackingCode(now = new Date()): string {
  const year = now.getFullYear()
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `FARO-${year}-${suffix}`
}

export function savePortalReport(input: {
  description: string
  contactPhone?: string
  contactEmail?: string
  contactName?: string
}): PortalTrackedReport {
  const now = new Date().toISOString()
  const report: PortalTrackedReport = {
    code: generateTrackingCode(),
    description: input.description.trim(),
    contactPhone: input.contactPhone?.trim() || undefined,
    contactEmail: input.contactEmail?.trim() || undefined,
    contactName: input.contactName?.trim() || undefined,
    status: 'Recibido',
    createdAt: now,
    updatedAt: now,
  }
  const all = readAll()
  all.unshift(report)
  writeAll(all.slice(0, 50))
  return report
}

export function findPortalReport(code: string): PortalTrackedReport | null {
  const normalized = code.trim().toUpperCase()
  return readAll().find((r) => r.code.toUpperCase() === normalized) ?? null
}

/** Demo: si el código no existe, devolver mock de ejemplo para probar la UI. */
export function lookupPortalReport(code: string): PortalTrackedReport | null {
  const found = findPortalReport(code)
  if (found) return found

  const normalized = code.trim().toUpperCase()
  if (normalized === 'FARO-2026-DEMO') {
    return {
      code: 'FARO-2026-DEMO',
      description: 'Reporte de ejemplo para probar el seguimiento.',
      status: 'En revisión',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  return null
}

export const PORTAL_REPORT_STATUSES: PortalReportStatus[] = [
  'Recibido',
  'En revisión',
  'Asignado a un centro',
  'Resuelto',
]
