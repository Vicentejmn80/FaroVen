import { reportRepository } from '@/repositories/report-repository'
import { publicNeedRepository } from '@/repositories/public-need-repository'
import { caseRepository } from '@/repositories/case-repository'
import { caseService } from '@/services/case-service'
import { caseManagerService } from '@/services/case-manager-service'
import { requestInventoryFromCenter } from '@/services/logistics-service'
import type { CaseDomain, CasePriority, OperationType } from '@/domain/case-lifecycle.types'
import { OPERATION_TYPES } from '@/domain/case-lifecycle.types'
import { opsChannelLog } from '@/lib/operational-log'
import { resolveCatalogKey } from '@/lib/resource-catalog'
import { supabase } from '@/lib/supabase'

export type WizardOperationKind =
  | 'critical_immediate'
  | 'high_priority'
  | 'citizen_coverage'
  | 'follow_up'

export type WizardDispatchAnswer = 'yes' | 'no' | 'unknown'

export type WizardStrategy =
  | { mode: 'center_first'; centerId: string; dispatchAnswer: WizardDispatchAnswer; openVolunteerCallIfNo: boolean }
  | { mode: 'open_volunteer_call' }
  | { mode: 'manual_review' }

export interface OperationalWizardInput {
  reportId: string
  actorId?: string
  operationKind: WizardOperationKind
  priority: CasePriority
  /** Categoría/clave elegida del catálogo (ideal) o texto libre. */
  needKeyOrText: string
  /** Selección jerárquica (solo para logging/telemetría). */
  needCategoryLabel?: string
  /** Personas afectadas (informativo) */
  peopleAffected: number
  /** Cantidad requerida del recurso (operativa) */
  requiredQuantity: number
  /** Duración (solo Cobertura ciudadana) */
  durationHours?: 6 | 12 | 24
  /** Override de ubicación si el reporte no tenía GPS */
  locationOverride?: { lat: number; lng: number; zone?: string; address?: string; label?: string }
  strategy: WizardStrategy
}

export interface OperationalWizardResult {
  case: CaseDomain
  publicNeedId?: string
}

function operationTypeFromKind(kind: WizardOperationKind): OperationType {
  if (kind === 'citizen_coverage') return OPERATION_TYPES.VOLUNTEER_MISSION
  if (kind === 'high_priority') return OPERATION_TYPES.RESOURCE_REQUEST
  if (kind === 'follow_up') return OPERATION_TYPES.INCIDENT
  return OPERATION_TYPES.INCIDENT
}

function defaultTitle(input: { operationKind: WizardOperationKind; needLabel: string; zone: string }): string {
  if (input.operationKind === 'citizen_coverage') return `Cobertura ciudadana: ${input.needLabel}`
  if (input.operationKind === 'critical_immediate') return `Crítico: ${input.needLabel}`
  if (input.operationKind === 'high_priority') return `Prioritario: ${input.needLabel}`
  return `Seguimiento: ${input.needLabel}`
}

export const operationalWizardService = {
  async createOperationalCaseFromReportWizard(input: OperationalWizardInput): Promise<OperationalWizardResult> {
    const started = Date.now()
    const report = await reportRepository.findWithAnalysis(input.reportId)
    if (!report) throw new Error('Reporte no encontrado')

    if (report.status === 'converted' || report.status === 'discarded') {
      throw new Error('Este reporte ya fue procesado y no puede convertirse de nuevo.')
    }

    const lat =
      input.locationOverride?.lat ??
      (report.location.coordinates.lat ?? 0)
    const lng =
      input.locationOverride?.lng ??
      (report.location.coordinates.lng ?? 0)

    const hasValidCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180

    if (!hasValidCoords) {
      throw new Error('Ubicación GPS requerida para abrir el caso operativo.')
    }

    if (input.locationOverride && input.locationOverride.label) {
      await reportRepository.updateLocation({
        id: input.reportId,
        latitude: lat,
        longitude: lng,
        siteLabel: input.locationOverride.label,
      })
    }

    const parseContactInfo = (raw?: string) => {
      if (!raw) return {}
      const parts = raw.split('|').map((p) => p.trim())
      return {
        name: parts[0] || undefined,
        phone: parts[1] || undefined,
        email: parts[2] || undefined,
      }
    }

    const rawNeed = (resolveCatalogKey(input.needKeyOrText) ?? input.needKeyOrText.trim()).trim()
    let resolvedResourceType = rawNeed
    let resolvedItemId: string | null = null
    let needLabel = rawNeed
    let unit = 'unidades'

    // Resolver contra items_catalog (sin IA). Si no existe, crear sugerencia pending_review.
    const { data: searchRows, error: searchErr } = await supabase.rpc('search_items_catalog', {
      p_query: rawNeed,
      p_limit: 1,
      p_include_pending: true,
    })
    if (searchErr) {
      opsChannelLog('CASE', {
        entityType: 'report',
        entityId: report.id,
        action: 'wizard_item_search_failed',
        actorId: input.actorId ?? null,
        actorRole: 'case_manager',
        source: 'service',
        error: searchErr.message,
        payload: { rawNeed },
      })
    }

    const best = (searchRows as Array<{
      item_id: string
      item_key: string
      canonical_name: string
      unit: string
      status: string
      match_kind: string
      match_score: number
    }> | null)?.[0]

    if (best?.item_id && best?.item_key) {
      resolvedItemId = best.item_id
      resolvedResourceType = best.item_key
      needLabel = best.canonical_name
      unit = best.unit || unit
    } else {
      const { data: created, error: createErr } = await supabase
        .from('items_catalog')
        .insert({
          canonical_name: rawNeed,
          unit: 'unidades',
          category: null,
          status: 'pending_review',
          created_from_report_id: report.id,
          created_by: input.actorId ?? null,
        })
        .select('id, key, canonical_name, unit')
        .single()
      if (createErr) throw createErr

      resolvedItemId = created.id
      resolvedResourceType = created.key
      needLabel = created.canonical_name
      unit = created.unit || unit

      const { error: aliasErr } = await supabase.from('item_aliases').insert({
        item_id: created.id,
        alias: rawNeed,
        status: 'pending_review',
        created_from_report_id: report.id,
        created_by: input.actorId ?? null,
      })
      // alias duplicado → ok (sin bloquear el wizard)
      if (aliasErr && (aliasErr as { code?: string }).code !== '23505') throw aliasErr
    }

    opsChannelLog('CASE', {
      entityType: 'report',
      entityId: report.id,
      action: 'wizard_started',
      actorId: input.actorId ?? null,
      actorRole: 'case_manager',
      source: 'service',
      payload: {
        operationKind: input.operationKind,
        priority: input.priority,
        needKeyOrText: input.needKeyOrText,
        resolvedResourceType,
        resolvedItemId,
        peopleAffected: input.peopleAffected,
        requiredQuantity: input.requiredQuantity,
        durationHours: input.durationHours ?? null,
        strategy: input.strategy,
      },
    })

    const title = defaultTitle({
      operationKind: input.operationKind,
      needLabel,
      zone: input.locationOverride?.zone ?? report.location.zone ?? 'Zona por confirmar',
    })

    const description =
      report.description +
      `\n\n[FARO Wizard] Tipo: ${input.operationKind} · Necesidad: ${needLabel} · Requerido: ${input.requiredQuantity} ${unit} · Personas afectadas: ${input.peopleAffected}`

    const wizardMetadata = {
      v: 1,
      operationKind: input.operationKind,
      needCategoryLabel: input.needCategoryLabel ?? null,
      needKeyOrText: input.needKeyOrText,
      resolvedResourceType,
      resolvedItemId,
      peopleAffected: input.peopleAffected,
      requiredQuantity: input.requiredQuantity,
      durationHours: input.durationHours ?? null,
      strategy: input.strategy,
    }

    let createdCase: CaseDomain
    try {
      createdCase = await caseRepository.createFromReportRpc({
        reportId: report.id,
        title,
        description,
        priority: input.priority,
        zone: input.locationOverride?.zone ?? report.location.zone ?? 'Zona por confirmar',
        category: resolvedResourceType,
        itemId: resolvedItemId,
        affectedCount: Math.max(1, input.requiredQuantity),
        location: {
          lat,
          lng,
          address: input.locationOverride?.address ?? report.location.address,
        },
        reporterInfo: parseContactInfo(report.contactInfo),
        requestSource: 'citizen',
        requestType: 'report',
        operationType: operationTypeFromKind(input.operationKind),
        wizardMetadata,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('not_authenticated')) {
        throw new Error('Sesión expirada. Vuelve a iniciar sesión e intenta de nuevo.')
      }
      if (message.includes('not_authorized') || message.includes('42501')) {
        throw new Error(
          'Tu usuario no tiene permisos de operador (Gestor de Casos) en FARO. Verifica tu rol en Perfil o contacta al administrador.',
        )
      }
      throw err
    }

    await reportRepository.markConverted({ id: report.id, caseId: createdCase.id })

    // El wizard ya es “revisión”: abrir el caso inmediatamente
    const reviewed = await caseService.startReview(createdCase.id, input.actorId)

    // Siempre garantizar una necesidad (borrador) ligada al caso.
    const existingNeeds = await publicNeedRepository.listByCaseId(reviewed.case.id)
    if (existingNeeds.length === 0) {
      await publicNeedRepository.createFromCase({
        caseId: reviewed.case.id,
        title,
        summary: report.description,
        category: resolvedResourceType,
        itemId: resolvedItemId,
        priority: input.priority,
        zone: reviewed.case.zone,
        location: {
          lat,
          lng,
          address: input.locationOverride?.address ?? report.location.address,
          zone: reviewed.case.zone,
        },
        actorId: input.actorId,
      })
    }

    let publicNeedId: string | undefined

    // Cobertura ciudadana: abrir convocatoria pública con reservas y duración fija.
    if (input.operationKind === 'citizen_coverage') {
      const { need } = await caseManagerService.openVolunteerCall(
        reviewed.case.id,
        input.actorId,
        {
          reservationsMode: true,
          requiredQuantity: Math.max(1, input.requiredQuantity),
          skipDecisionLog: true,
        },
      )
      publicNeedId = need.id

      if (input.durationHours) {
        const { error: expError } = await supabase
          .from('public_needs')
          .update({
            expires_at: new Date(Date.now() + input.durationHours * 3600000).toISOString(),
          })
          .eq('id', need.id)
        if (expError) {
          opsChannelLog('CASE', {
            entityType: 'public_need',
            entityId: need.id,
            action: 'wizard_need_expiry_update_failed',
            actorId: input.actorId ?? null,
            actorRole: 'case_manager',
            caseId: reviewed.case.id,
            source: 'service',
            error: expError.message,
            payload: { durationHours: input.durationHours },
          })
        }
      }

      opsChannelLog('CASE', {
        entityType: 'public_need',
        entityId: publicNeedId,
        action: 'wizard_citizen_coverage_opened',
        actorId: input.actorId ?? null,
        actorRole: 'case_manager',
        caseId: reviewed.case.id,
        source: 'service',
        payload: {
          durationHours: input.durationHours ?? null,
          requiredQuantity: input.requiredQuantity,
          resourceType: resolvedResourceType,
        },
      })
    }

    // Centro primero: asignar a centro compatible al final del wizard.
    if (input.strategy.mode === 'center_first') {
      await requestInventoryFromCenter({
        caseData: reviewed.case,
        centerId: input.strategy.centerId,
        resourceType: resolvedResourceType,
        quantity: Math.max(1, input.requiredQuantity),
        actorId: input.actorId ?? 'system',
      })

      opsChannelLog('CASE', {
        entityType: 'case',
        entityId: reviewed.case.id,
        action: 'wizard_center_assigned',
        actorId: input.actorId ?? null,
        actorRole: 'case_manager',
        from: reviewed.case.pipelineStage,
        to: reviewed.case.pipelineStage,
        source: 'service',
        payload: {
          centerId: input.strategy.centerId,
          dispatchAnswer: input.strategy.dispatchAnswer,
          openVolunteerCallIfNo: input.strategy.openVolunteerCallIfNo,
          resourceType: resolvedResourceType,
          requiredQuantity: input.requiredQuantity,
        },
      })

      if (input.strategy.dispatchAnswer === 'no' && input.strategy.openVolunteerCallIfNo) {
        const { need } = await caseManagerService.openVolunteerCall(
          reviewed.case.id,
          input.actorId,
          {
            reservationsMode: true,
            requiredQuantity: Math.max(1, input.requiredQuantity),
          },
        )
        publicNeedId = need.id
      }
    }

    // Estrategia: abrir convocatoria sin centro (fallback manual)
    if (input.strategy.mode === 'open_volunteer_call') {
      const { need } = await caseManagerService.openVolunteerCall(reviewed.case.id, input.actorId, {
        reservationsMode: true,
        requiredQuantity: Math.max(1, input.requiredQuantity),
      })
      publicNeedId = need.id
    }

    opsChannelLog('CASE', {
      entityType: 'case',
      entityId: reviewed.case.id,
      action: 'wizard_completed',
      actorId: input.actorId ?? null,
      actorRole: 'case_manager',
      from: report.id,
      to: reviewed.case.pipelineStage,
      source: 'service',
      durationMs: Date.now() - started,
      payload: {
        operationKind: input.operationKind,
        priority: input.priority,
        resourceType: resolvedResourceType,
        requiredQuantity: input.requiredQuantity,
        publicNeedId: publicNeedId ?? null,
      },
    })

    return { case: reviewed.case, publicNeedId }
  },
}

