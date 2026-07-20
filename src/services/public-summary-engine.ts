import type { OperationalStatus } from '@/lib/types'
import type { CenterType } from '@/domain/models'

export interface PublicSummaryMessage {
  id: string
  text: string
  tone: 'positive' | 'neutral' | 'warning' | 'critical'
}

interface NeedInfo {
  name: string
  coverage?: number
}

export interface PublicSummaryInput {
  status: OperationalStatus
  type: CenterType
  needs: NeedInfo[]
  capacity?: { current: number; total: number }
  schedule?: string
}

function formatItems(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  const last = items[items.length - 1]
  const rest = items.slice(0, -1)
  return `${rest.join(', ')} y ${last}`
}

function buildSummary(inputs: PublicSummaryInput): PublicSummaryMessage[] {
  const messages: PublicSummaryMessage[] = []
  const { status, needs, capacity } = inputs

  // 1. Status-based messages
  if (status === 'critical') {
    messages.push({
      id: 'status-critical',
      text: 'Centro en situación crítica. Consulta otro centro cercano.',
      tone: 'critical',
    })
  } else if (status === 'warning') {
    messages.push({
      id: 'status-warning',
      text: 'Centro con atención limitada.',
      tone: 'warning',
    })
  }

  // 2. Capacity for shelters
  if (capacity && capacity.total > 0) {
    const ratio = capacity.current / capacity.total
    if (ratio > 0.9) {
      messages.push({
        id: 'capacity-high',
        text: 'Centro con alta ocupación.',
        tone: 'warning',
      })
    } else if (ratio > 0.7) {
      messages.push({
        id: 'capacity-moderate',
        text: 'Centro con ocupación moderada.',
        tone: 'neutral',
      })
    } else if (ratio < 0.3) {
      messages.push({
        id: 'capacity-low',
        text: 'Centro con baja ocupación.',
        tone: 'positive',
      })
    }
  }

  // 3. Needs with low coverage → "necesita"
  const lowCoverage = needs.filter((n) => n.coverage !== undefined && n.coverage < 30)
  if (lowCoverage.length > 0) {
    const items = lowCoverage.slice(0, 3).map((n) => n.name.toLowerCase())
    messages.push({
      id: 'needs-critical',
      text: `Actualmente necesita ${formatItems(items)}.`,
      tone: 'critical',
    })
  }

  // 4. Needs with medium coverage → "recibe"
  const mediumCoverage = needs.filter(
    (n) => n.coverage !== undefined && n.coverage >= 30 && n.coverage < 70,
  )
  if (mediumCoverage.length > 0) {
    const items = mediumCoverage.slice(0, 3).map((n) => n.name.toLowerCase())
    messages.push({
      id: 'needs-medium',
      text: `Actualmente recibe donaciones de ${formatItems(items)}.`,
      tone: 'neutral',
    })
  }

  // 5. Needs with high coverage → "acepta"
  const highCoverage = needs.filter((n) => n.coverage !== undefined && n.coverage >= 70)
  if (highCoverage.length > 0) {
    const items = highCoverage.slice(0, 3).map((n) => n.name.toLowerCase())
    messages.push({
      id: 'needs-covered',
      text: `Actualmente acepta donaciones de ${formatItems(items)}.`,
      tone: 'positive',
    })
  }

  // 6. Needs without coverage info (demo mode) → show as "necesita"
  const needsNoCoverage = needs.filter((n) => n.coverage === undefined)
  if (needsNoCoverage.length > 0 && lowCoverage.length === 0) {
    const items = needsNoCoverage.slice(0, 4).map((n) => n.name.toLowerCase())
    messages.push({
      id: 'needs-demo',
      text: `Actualmente necesita ${formatItems(items)}.`,
      tone: 'neutral',
    })
  }

  // 7. No messages yet → operating normally
  if (messages.length === 0) {
    messages.push({
      id: 'operating-normal',
      text: 'Centro operando con normalidad.',
      tone: 'positive',
    })
  }

  // 8. Schedule
  if (inputs.schedule) {
    messages.push({
      id: 'schedule',
      text: `Horario: ${inputs.schedule}`,
      tone: 'neutral',
    })
  }

  return messages
}

export function generatePublicSummary(input: PublicSummaryInput): PublicSummaryMessage[] {
  return buildSummary(input)
}
