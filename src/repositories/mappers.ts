import type {
  Center,
  CenterType,
  ConfidenceLevel,
  Event,
  Need,
  NeedStatus,
  OperationalStatus,
  Organization,
  PriorityLevel,
  Report,
} from '@/domain/models'
import { parseCoord } from '@/lib/utils'
import type {
  EventRow,
  HospitalRow,
  NeedRow,
  OrganizationRow,
  ReportRow,
  ShelterRow,
  SupplyCenterRow,
} from '@/types/supabase'

export function toOperationalStatus(status?: string | null): OperationalStatus {
  if (!status) return 'info'
  const normalized = status.toLowerCase()
  if (normalized.includes('critical')) return 'critical'
  if (normalized.includes('warning') || normalized.includes('attention')) return 'warning'
  if (normalized.includes('active') || normalized.includes('operational')) return 'operational'
  return 'info'
}

export function toPriorityLevel(status: OperationalStatus, occupancyPct: number): PriorityLevel {
  if (status === 'critical' || occupancyPct >= 90) return 'critical'
  if (status === 'warning' || occupancyPct >= 75) return 'high'
  if (occupancyPct >= 50) return 'medium'
  return 'low'
}

export function toNeedStatus(
  required: number,
  received: number,
  status?: string | null,
): NeedStatus {
  if (status === 'pending_closure') return 'pending_closure'
  if (status === 'reopened') return 'reopened'
  if (status === 'resolved') return 'resolved'
  if (status === 'active') return 'active'
  if (received >= required && required > 0) return 'resolved'
  return 'active'
}

export function toDate(value?: string | null): Date {
  return value ? new Date(value) : new Date()
}

export function toConfidenceLevel(): ConfidenceLevel {
  return 'medium'
}

function baseCenter(input: {
  id: string
  name: string
  type: CenterType
  address?: string | null
  municipality?: string | null
  state?: string | null
  lat?: number | null
  lng?: number | null
  contactName?: string | null
  phone?: string | null
  capacity?: number | null
  currentOcc?: number | null
  schedule?: string | null
  notes?: string | null
  status?: string | null
  updatedAt?: string | null
}): Center {
  const total = input.capacity ?? 100
  const current = input.currentOcc ?? 0
  const status = toOperationalStatus(input.status)
  const occupancyPct = Math.round((current / Math.max(total, 1)) * 100)
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    status,
    priority: toPriorityLevel(status, occupancyPct),
    location: {
      zone: input.municipality ?? input.state ?? 'Caracas',
      address: input.address ?? 'Sin dirección',
      coordinates: {
        lat: parseCoord(input.lat),
        lng: parseCoord(input.lng),
      },
    },
    capacity: { current, total },
    responsible: { name: input.contactName ?? 'Sin responsable', role: 'Coordinación local' },
    updatedAt: toDate(input.updatedAt),
    confidence: toConfidenceLevel(),
    needIds: [],
    eventIds: [],
    reportIds: [],
    photos: [],
    municipality: input.municipality ?? undefined,
    state: input.state ?? undefined,
    phone: input.phone ?? undefined,
    schedule: input.schedule ?? undefined,
    observations: input.notes ?? undefined,
  }
}

export function hospitalRowToCenter(row: HospitalRow): Center {
  return baseCenter({
    id: row.id,
    name: row.name,
    type: 'hospital',
    address: row.address,
    municipality: row.municipality,
    state: row.state,
    lat: row.latitude,
    lng: row.longitude,
    contactName: row.contact_name,
    phone: row.phone,
    capacity: row.capacity,
    currentOcc: row.current_occ,
    notes: row.notes,
    status: row.status,
    updatedAt: row.updated_at,
  })
}

export function shelterRowToCenter(row: ShelterRow): Center {
  return baseCenter({
    id: row.id,
    name: row.name,
    type: 'shelter',
    address: row.address,
    municipality: row.municipality,
    state: row.state,
    lat: row.latitude,
    lng: row.longitude,
    contactName: row.contact_name,
    phone: row.contact_phone,
    capacity: row.capacity,
    currentOcc: row.current_occ,
    notes: row.notes,
    status: row.status,
    updatedAt: row.updated_at,
  })
}

export function supplyCenterRowToCenter(row: SupplyCenterRow): Center {
  return baseCenter({
    id: row.id,
    name: row.name,
    type: 'supply_center',
    address: row.address,
    municipality: row.municipality,
    state: row.state,
    lat: row.latitude,
    lng: row.longitude,
    contactName: row.contact_name,
    phone: row.contact_phone,
    capacity: 0,
    currentOcc: 0,
    schedule: row.schedule,
    notes: row.notes,
    status: row.status,
    updatedAt: row.updated_at,
  })
}

export function needRowToNeed(row: NeedRow): Need {
  return {
    id: row.id,
    centerId: row.needable_id,
    type: row.item_name,
    required: row.qty_required,
    available: row.qty_received,
    priority: row.priority,
    status: toNeedStatus(row.qty_required, row.qty_received, row.status),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    cycleDurationHours: row.cycle_duration_hours ?? undefined,
    cycleNumber: row.cycle_number ?? undefined,
    cycleStartedAt: row.cycle_started_at ? new Date(row.cycle_started_at) : undefined,
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
    closureReason: row.closure_reason ?? null,
  }
}

export function reportRowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    type:
      row.type === 'inventory' || row.type === 'saturation' || row.type === 'access' || row.type === 'shelter' || row.type === 'health'
        ? row.type
        : 'other',
    description: row.description,
    userId: row.reported_by ?? 'anonymous',
    source: row.source ?? row.contact_info ?? 'Sin fuente',
    createdAt: toDate(row.created_at),
    status: row.status === 'verified' ? 'verified' : row.status === 'dismissed' ? 'discarded' : 'new',
    confidence: 'medium',
    photoUrls: [],
    location: {
      zone: row.site_label ?? 'Caracas',
      address: row.site_label ?? 'Ubicación reportada',
      coordinates: { lat: row.latitude ?? 10.48, lng: row.longitude ?? -66.9 },
    },
    centerId: row.site_id ?? undefined,
    contactInfo: row.contact_info ?? undefined,
  }
}

const EVENT_KINDS = new Set([
  'inventory',
  'inventory_complete',
  'need_created',
  'need_resolved',
  'need_reopened',
  'cycle_closed',
  'coordinator_approved',
  'saturation',
  'report',
  'request',
  'resolved',
  'road_blocked',
  'center_opened',
  'person_found',
] as const)

export function eventRowToEvent(row: EventRow): Event {
  const kind = EVENT_KINDS.has(row.kind as never) ? (row.kind as Event['kind']) : 'report'
  return {
    id: row.id,
    kind,
    title: row.title,
    detail: row.detail ?? '',
    centerId: row.center_id ?? undefined,
    reportId: row.report_id ?? undefined,
    status: toOperationalStatus(row.status),
    createdAt: toDate(row.created_at),
  }
}

import type { CaseAssignment, CaseDomain, CaseDomainEvent, CasePriority, PipelineStage, CaseEventType } from '@/domain/case-lifecycle.types'
import type { CaseAssignmentRow, CaseEventRow, CaseRow } from '@/types/supabase'

export function caseRowToDomain(row: CaseRow): CaseDomain {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority as CasePriority,
    pipelineStage: row.pipeline_stage as PipelineStage,
    location: {
      lat: row.latitude ?? 0,
      lng: row.longitude ?? 0,
      address: row.address ?? undefined,
      zone: row.zone,
    },
    zone: row.zone,
    affectedCount: row.affected_count,
    reporterInfo: {
      name: row.reporter_name ?? undefined,
      phone: row.reporter_phone ?? undefined,
      email: row.reporter_email ?? undefined,
      relationship: row.reporter_relationship ?? undefined,
    },
    category: row.category ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    assignedCenterId: row.assigned_center_id ?? undefined,
    assignedAt: row.assigned_at ? new Date(row.assigned_at) : undefined,
    slaDeadline: row.sla_deadline ? new Date(row.sla_deadline) : undefined,
    firstResponseAt: row.first_response_at ? new Date(row.first_response_at) : undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export function caseDomainToRow(domain: Partial<CaseDomain>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (domain.title !== undefined) row.title = domain.title
  if (domain.description !== undefined) row.description = domain.description
  if (domain.priority !== undefined) row.priority = domain.priority
  if (domain.pipelineStage !== undefined) row.pipeline_stage = domain.pipelineStage
  if (domain.location !== undefined) {
    row.latitude = domain.location.lat
    row.longitude = domain.location.lng
    row.address = domain.location.address ?? null
    if (domain.location.zone !== undefined) row.zone = domain.location.zone
  } else {
    if (domain.zone !== undefined) row.zone = domain.zone
  }
  if (domain.affectedCount !== undefined) row.affected_count = domain.affectedCount
  if (domain.reporterInfo !== undefined) {
    row.reporter_name = domain.reporterInfo.name ?? null
    row.reporter_phone = domain.reporterInfo.phone ?? null
    row.reporter_email = domain.reporterInfo.email ?? null
    row.reporter_relationship = domain.reporterInfo.relationship ?? null
  }
  if (domain.category !== undefined) row.category = domain.category ?? null
  if (domain.assignedTo !== undefined) row.assigned_to = domain.assignedTo ?? null
  if (domain.assignedCenterId !== undefined) row.assigned_center_id = domain.assignedCenterId ?? null
  if (domain.assignedAt !== undefined) row.assigned_at = domain.assignedAt?.toISOString() ?? null
  if (domain.slaDeadline !== undefined) row.sla_deadline = domain.slaDeadline?.toISOString() ?? null
  if (domain.firstResponseAt !== undefined) row.first_response_at = domain.firstResponseAt?.toISOString() ?? null
  if (domain.resolvedAt !== undefined) row.resolved_at = domain.resolvedAt?.toISOString() ?? null
  return row
}

export function caseEventRowToDomain(row: CaseEventRow): CaseDomainEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    eventType: row.event_type as CaseEventType,
    fromStage: (row.from_stage ?? undefined) as PipelineStage | undefined,
    toStage: (row.to_stage ?? undefined) as PipelineStage | undefined,
    actorId: row.actor_id ?? undefined,
    comment: row.comment ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

export function caseAssignmentRowToDomain(row: CaseAssignmentRow): CaseAssignment {
  return {
    id: row.id,
    caseId: row.case_id,
    centerId: row.center_id,
    assignedBy: row.assigned_by,
    assignedTo: row.assigned_to ?? undefined,
    status: row.status,
    assignedAt: new Date(row.assigned_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : undefined,
    reason: row.reason ?? undefined,
  }
}

export function organizationRowToOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    kind: row.type === 'government' || row.type === 'community' ? row.type : 'ngo',
    coverageZones: [],
  }
}
