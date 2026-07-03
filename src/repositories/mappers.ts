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

export function toNeedStatus(required: number, received: number): NeedStatus {
  if (received >= required && required > 0) return 'covered'
  return received <= 0 ? 'active' : 'active'
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
    capacity: 100,
    currentOcc: 45,
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
    status: toNeedStatus(row.qty_required, row.qty_received),
    updatedAt: toDate(row.updated_at),
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
  }
}

export function eventRowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    kind:
      row.kind === 'inventory' ||
      row.kind === 'saturation' ||
      row.kind === 'report' ||
      row.kind === 'request' ||
      row.kind === 'resolved' ||
      row.kind === 'road_blocked' ||
      row.kind === 'center_opened' ||
      row.kind === 'person_found'
        ? row.kind
        : 'report',
    title: row.title,
    detail: row.detail ?? '',
    centerId: row.center_id ?? undefined,
    reportId: row.report_id ?? undefined,
    status: toOperationalStatus(row.status),
    createdAt: toDate(row.created_at),
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
