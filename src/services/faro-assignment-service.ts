import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { supabase } from '@/lib/supabase'
import { notifyUser } from '@/lib/notify'
import { assignmentService } from '@/services/assignment-service'
import { requestInventoryFromCenter } from '@/services/logistics-service'
import type { CenterDispatchMode } from '@/services/faro-recommendation-engine'

const CENTER_TABLES = ['hospitals', 'shelters', 'supply_centers'] as const

export async function resolveCenterDispatchMode(centerId: string): Promise<CenterDispatchMode> {
  for (const table of CENTER_TABLES) {
    const { data } = await supabase
      .from(table)
      .select('dispatch_mode')
      .eq('id', centerId)
      .maybeSingle()
    const raw = (data as { dispatch_mode?: string | null } | null)?.dispatch_mode
    if (raw === 'brigade' || raw === 'needs_volunteers' || raw === 'mixed') return raw
    if (data) return 'mixed'
  }
  return 'mixed'
}

export function canOpenRadarForCase(
  caseData: CaseDomain,
  dispatchMode?: CenterDispatchMode | null,
  opts?: { hasViableCenters?: boolean },
): { allowed: boolean; reason?: string } {
  if (dispatchMode === 'brigade') {
    return { allowed: false, reason: 'Este centro opera con brigada propia — no usa radar.' }
  }
  if (
    dispatchMode === 'needs_volunteers' &&
    caseData.assignedCenterId &&
    caseData.pipelineStage === 'awaiting_center_confirmation'
  ) {
    return {
      allowed: false,
      reason: 'El radar se abre automáticamente si el centro indica que necesita voluntario.',
    }
  }
  // Centro primero: en revisión, Radar solo si no hay centros viables
  if (
    caseData.pipelineStage === 'pending_review' &&
    opts?.hasViableCenters === true
  ) {
    return {
      allowed: false,
      reason: 'Solicita primero a un centro recomendado. El radar es fallback.',
    }
  }
  return { allowed: true }
}

async function notifyCoordinatorOfBrigadeAssign(input: {
  centerId: string
  caseData: CaseDomain
  actorId: string
}): Promise<void> {
  try {
    const { data } = await supabase
      .from('coordinator_assignments')
      .select('user_id')
      .eq('site_id', input.centerId)
      .eq('status', 'active')
    const userIds = (data ?? []).map((r) => String((r as { user_id: string }).user_id))
    if (userIds.length === 0) return
    const body = `Caso "${input.caseData.title}" asignado — preparar despacho con brigada propia.`
    await Promise.all(
      userIds.map((userId) =>
        notifyUser(userId, 'Nueva asignación al centro', body, 'center_assignment', {
          caseId: input.caseData.id,
          centerId: input.centerId,
        }),
      ),
    )
  } catch {
    // Non-blocking
  }
}

export async function assignCaseWithDispatchRules(input: {
  caseData: CaseDomain
  centerId: string
  actorId: string
  inventoryTip?: { available: number; resourceType: string; quantity: number }
  reason?: string
}) {
  const dispatchMode = await resolveCenterDispatchMode(input.centerId)

  if (input.inventoryTip) {
    return requestInventoryFromCenter({
      caseData: input.caseData,
      centerId: input.centerId,
      resourceType: input.inventoryTip.resourceType,
      quantity: input.inventoryTip.quantity,
      actorId: input.actorId,
    })
  }

  const assignment = await assignmentService.assign(
    input.caseData.id,
    input.centerId,
    input.actorId,
    undefined,
    input.reason ?? `Asignación FARO (${dispatchMode})`,
  )

  if (dispatchMode === 'brigade') {
    await notifyCoordinatorOfBrigadeAssign({
      centerId: input.centerId,
      caseData: input.caseData,
      actorId: input.actorId,
    })
  }

  return { assignment, dispatchMode }
}
