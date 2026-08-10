import { supabase } from '@/lib/supabase'
import { caseService } from '@/services/case-service'
import { missionRepository } from '@/repositories/mission-repository'
import { volunteerRepository } from '@/repositories/volunteer-repository'
import { publicNeedRepository } from '@/repositories/public-need-repository'
import { resolveCaseResource } from '@/domain/case-resource'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import type { MissionAssignmentStatus } from '@/domain/mission.types'

const ACTIVE_STATUSES: MissionAssignmentStatus[] = [
  'assigned',
  'accepted',
  'preparing',
  'en_route',
  'on_site',
  'in_progress',
  'completed',
]

export interface CoverageContribution {
  assignmentId: string
  missionId: string
  volunteerId: string
  volunteerName: string
  quantity: number
  status: MissionAssignmentStatus
  label: string
  icon: string
}

export interface CaseCoverageSnapshot {
  caseId: string
  required: number
  covered: number
  committed: number
  remaining: number
  complete: boolean
  resourceLabel: string
  contributions: CoverageContribution[]
  activeVolunteers: number
}

function contributionLabel(status: MissionAssignmentStatus): { label: string; icon: string } {
  if (status === 'verified') return { label: 'Entregado', icon: '✅' }
  if (status === 'completed') return { label: 'Entregado (esperando validación)', icon: '✅' }
  if (status === 'en_route') return { label: 'En camino', icon: '🚗' }
  if (status === 'on_site' || status === 'in_progress') return { label: 'En sitio', icon: '📍' }
  if (status === 'preparing' || status === 'accepted' || status === 'assigned') {
    return { label: 'Preparando', icon: '🧰' }
  }
  return { label: status, icon: '●' }
}

/** Cobertura acumulativa del caso a partir de mission_assignments.quantity. */
export async function getCaseCoverage(caseId: string): Promise<CaseCoverageSnapshot> {
  const caseData = await caseService.getById(caseId)
  if (!caseData) {
    return {
      caseId,
      required: 1,
      covered: 0,
      committed: 0,
      remaining: 1,
      complete: false,
      resourceLabel: 'recurso',
      contributions: [],
      activeVolunteers: 0,
    }
  }

  const resource = resolveCaseResource(caseData)
  const missions = await missionRepository.listByCaseId(caseId)
  const contributions: CoverageContribution[] = []

  for (const mission of missions) {
    const assignments = await missionRepository.listAssignments(mission.id)
    for (const a of assignments) {
      if (a.status === 'rejected' || a.status === 'cancelled' || a.status === 'archived') continue
      const qty = Math.max(1, a.quantity ?? mission.resourceQty ?? 1)
      let volunteerName = 'Voluntario'
      try {
        const identity = await volunteerRepository.findIdentity(a.volunteerId)
        if (identity?.fullName) volunteerName = identity.fullName
      } catch {
        // ignore
      }
      const { label, icon } = contributionLabel(a.status)
      contributions.push({
        assignmentId: a.id,
        missionId: mission.id,
        volunteerId: a.volunteerId,
        volunteerName,
        quantity: qty,
        status: a.status,
        label,
        icon,
      })
    }
  }

  // También cuenta entregas de centro (brigada) validadas vía inventory delivered
  const { data: centerDeliveries } = await supabase
    .from('inventory_reservations')
    .select('id, quantity, status, resolution_mode')
    .eq('case_id', caseId)
    .eq('status', 'delivered')

  let centerCovered = 0
  for (const row of centerDeliveries ?? []) {
    const mode = (row as { resolution_mode?: string | null }).resolution_mode
    if (mode === 'brigade' || mode === 'delivery') {
      centerCovered += Math.max(1, Number((row as { quantity: number }).quantity) || 1)
    }
  }

  const covered =
    contributions
      .filter((c) => c.status === 'verified')
      .reduce((s, c) => s + c.quantity, 0) + centerCovered

  const committed = contributions
    .filter((c) => ACTIVE_STATUSES.includes(c.status))
    .reduce((s, c) => s + c.quantity, 0)

  const required = resource.requiredQty
  const remaining = Math.max(0, required - covered)
  const activeVolunteers = contributions.filter((c) => ACTIVE_STATUSES.includes(c.status)).length

  return {
    caseId,
    required,
    covered: Math.min(covered, required),
    committed,
    remaining,
    complete: covered >= required,
    resourceLabel: resource.resourceLabel,
    contributions: contributions.sort((a, b) => {
      const order = (s: string) => (s === 'verified' ? 2 : s === 'completed' ? 1 : 0)
      return order(a.status) - order(b.status)
    }),
    activeVolunteers,
  }
}

export async function getCaseCoverageMap(
  caseIds: string[],
): Promise<Record<string, CaseCoverageSnapshot>> {
  const unique = [...new Set(caseIds.filter(Boolean))]
  const entries = await Promise.all(
    unique.map(async (id) => [id, await getCaseCoverage(id)] as const),
  )
  return Object.fromEntries(entries)
}

/** Sincroniza public_needs.covered_quantity con la cobertura verificada. */
export async function syncPublicNeedCoveredQuantity(
  caseId: string,
  covered: number,
): Promise<void> {
  try {
    const needs = await publicNeedRepository.listByCaseId(caseId)
    for (const need of needs) {
      await supabase
        .from('public_needs')
        .update({
          covered_quantity: Math.min(need.requiredQuantity, Math.max(0, covered)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', need.id)
    }
  } catch {
    console.warn('[COVERAGE] No se pudo sincronizar covered_quantity del public_need')
  }
}

/** Tras cobertura parcial: reabre convocatoria si aún falta cantidad. */
export async function reopenCoverageIfNeeded(
  caseData: CaseDomain,
  actorId: string | undefined,
  remaining: number,
): Promise<void> {
  if (remaining <= 0) return

  // Mantener/volver a esperando cobertura
  if (
    caseData.pipelineStage === 'assigned' ||
    caseData.pipelineStage === 'accepted' ||
    caseData.pipelineStage === 'in_attention'
  ) {
    try {
      await caseService.transition(
        caseData.id,
        'open_for_applications',
        actorId,
        `Cobertura parcial — faltan ${remaining} unidades`,
      )
    } catch {
      // Si la transición no está permitida, el caso permanece en progreso
    }
  }

  try {
    const needs = await publicNeedRepository.listByCaseId(caseData.id)
    for (const need of needs) {
      if (need.callStatus !== 'open') {
        await publicNeedRepository.updateCallStatus({
          publicNeedId: need.id,
          callStatus: 'open',
        })
      }
      // Ajustar requerido restante visible en radar
      const stillNeeded = Math.max(remaining, 1)
      if (need.requiredQuantity !== stillNeeded + need.coveredQuantity) {
        await publicNeedRepository.updateRequiredQuantity(
          need.id,
          need.coveredQuantity + stillNeeded,
        )
      }
    }
  } catch {
    console.warn('[COVERAGE] No se pudo reabrir convocatoria tras cobertura parcial')
  }
}
