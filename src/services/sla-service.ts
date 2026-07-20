import {
  calculateSlaDeadline,
  calculateSlaProgress,
  isSlaBreached,
  isActiveStage,
} from '@/domain/case-lifecycle.service'
import type { CaseDomain, CasePriority, PipelineStage } from '@/domain/case-lifecycle.types'
import { caseRepository } from '@/repositories/case-repository'

export type SlaState = 'on_track' | 'warning' | 'breached' | 'completed'

export interface SlaInfo {
  deadline: Date | undefined
  progress: number
  breached: boolean
  state: SlaState
  remainingMs: number
}

export interface SlaSummary {
  onTrack: number
  warning: number
  breached: number
  completed: number
  slaCompliancePct: number
}

export const slaService = {
  getSlaInfo(caseData: CaseDomain): SlaInfo {
    if (caseData.resolvedAt) {
      return {
        deadline: caseData.slaDeadline,
        progress: 1,
        breached: false,
        state: 'completed',
        remainingMs: 0,
      }
    }

    if (!caseData.slaDeadline) {
      return {
        deadline: undefined,
        progress: 0,
        breached: false,
        state: 'completed',
        remainingMs: 0,
      }
    }

    const deadline = new Date(caseData.slaDeadline)
    const breached = isSlaBreached(deadline)
    const progress = calculateSlaProgress(caseData.createdAt, deadline)
    const remainingMs = Math.max(0, deadline.getTime() - Date.now())

    let state: SlaState = 'on_track'
    if (breached) {
      state = 'breached'
    } else if (progress >= 0.75) {
      state = 'warning'
    }

    return { deadline, progress, breached, state, remainingMs }
  },

  async setDeadline(caseId: string, priority: CasePriority): Promise<void> {
    const caseData = await caseRepository.findById(caseId)
    if (!caseData) throw new Error(`Caso no encontrado: ${caseId}`)

    const deadline = calculateSlaDeadline(priority, new Date())
    await caseRepository.update(caseId, { slaDeadline: deadline, priority })
  },

  async checkBreachedCases(): Promise<CaseDomain[]> {
    const active = await caseRepository.list({
      stages: ['nuevo', 'pending_review', 'validating', 'awaiting_info', 'assigned', 'accepted', 'in_attention'],
    })
    return active.filter(
      (c) => c.slaDeadline && isSlaBreached(new Date(c.slaDeadline)),
    )
  },

  getSlaSummary(cases: CaseDomain[]): SlaSummary {
    const activeCases = cases.filter((c) => isActiveStage(c.pipelineStage as PipelineStage))

    let onTrack = 0
    let warning = 0
    let breached = 0
    let completed = 0

    for (const c of activeCases) {
      const info = this.getSlaInfo(c)
      if (info.state === 'breached') breached++
      else if (info.state === 'warning') warning++
      else onTrack++
    }

    for (const c of cases) {
      if (c.resolvedAt || c.pipelineStage === ('resolved' as PipelineStage) || c.pipelineStage === ('archived' as PipelineStage)) {
        completed++
      }
    }

    const total = onTrack + warning + breached + completed
    const slaCompliancePct = total > 0 ? Math.round(((onTrack + completed) / total) * 100) : 100

    return { onTrack, warning, breached, completed, slaCompliancePct }
  },
}
