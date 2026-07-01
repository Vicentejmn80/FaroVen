export interface HospitalRow {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  contact_name: string | null
  capacity: number | null
  current_occ: number | null
  status: string | null
  updated_at: string | null
}

export interface ShelterRow {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  contact_name: string | null
  capacity: number | null
  current_occ: number | null
  status: string | null
  updated_at: string | null
}

export interface SupplyCenterRow {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  contact_name: string | null
  status: string | null
  updated_at: string | null
}

export interface NeedRow {
  id: string
  needable_type: string
  needable_id: string
  item_name: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  qty_required: number
  qty_received: number
  pct_covered?: number | null
  updated_at: string | null
}

export interface ReportRow {
  id: string
  type: string
  description: string
  source?: string | null
  reported_by?: string | null
  contact_info?: string | null
  status: string
  created_at: string
  site_type?: string | null
  site_id?: string | null
  site_label?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface EventRow {
  id: string
  kind: string
  title: string
  detail: string | null
  status: string
  center_type: string | null
  center_id: string | null
  report_id: string | null
  created_at: string
}

export interface OrganizationRow {
  id: string
  name: string
  type: string | null
  contact: string | null
  logo: string | null
}
