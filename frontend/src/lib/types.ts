export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      persons: {
        Row: Person
        Insert: Omit<Person, 'id' | 'created_at' | 'updated_at' | 'full_name_ts'>
        Update: Partial<Omit<Person, 'id'>>
      }
      hospitals: {
        Row: Hospital
        Insert: Omit<Hospital, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Hospital, 'id'>>
      }
      shelters: {
        Row: Shelter
        Insert: Omit<Shelter, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Shelter, 'id'>>
      }
      supply_centers: {
        Row: SupplyCenter
        Insert: Omit<SupplyCenter, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SupplyCenter, 'id'>>
      }
      needs: {
        Row: Need
        Insert: Omit<Need, 'id' | 'pct_covered' | 'updated_at'>
        Update: Partial<Omit<Need, 'id' | 'pct_covered'>>
      }
      reports: {
        Row: Report
        Insert: Omit<Report, 'id' | 'created_at' | 'status'>
        Update: Partial<Omit<Report, 'id'>>
      }
      sources: {
        Row: Source
        Insert: Omit<Source, 'id' | 'created_at'>
        Update: Partial<Omit<Source, 'id'>>
      }
      updates: {
        Row: Update
        Insert: Omit<Update, 'id' | 'created_at'>
        Update: Partial<Omit<Update, 'id'>>
      }
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id'>>
      }
      bulletins: {
        Row: Bulletin
        Insert: Omit<Bulletin, 'id' | 'created_at'>
        Update: Partial<Omit<Bulletin, 'id'>>
      }
    }
    Functions: {
      search_person: {
        Args: { p_first_name?: string; p_last_name?: string; p_limit?: number }
        Returns: PersonSearchResult[]
      }
    }
  }
}

export type PersonStatus = 'safe' | 'injured' | 'transferred' | 'deceased' | 'unknown'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type NeedPriority = 'critical' | 'high' | 'medium' | 'low'
export type UpdateStatus = 'pending_review' | 'approved' | 'rejected'
export type ReportType = 'wrong_info' | 'person_found' | 'person_transferred' | 'hospital_changed' | 'need_covered' | 'other'
export type ReportStatus = 'pending' | 'under_review' | 'verified' | 'dismissed'
export type BulletinKind = 'general' | 'person_update' | 'need_alert' | 'distribution'

export interface Person {
  id: string
  first_name: string
  last_name: string
  full_name_ts: string | null
  status: PersonStatus
  hospital_id: string | null
  shelter_id: string | null
  confidence: ConfidenceLevel
  source_id: string | null
  notes: string | null
  reported_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PersonSearchResult {
  id: string
  first_name: string
  last_name: string
  status: PersonStatus
  hospital_name: string | null
  shelter_name: string | null
  confidence: ConfidenceLevel
  source_name: string | null
  updated_at: string
  notes: string | null
  rank: number
}

export interface Hospital {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  contact_name: string | null
  capacity: number | null
  current_occ: number | null
  status: string
  notes: string | null
  is_anchor: boolean
  created_at: string
  updated_at: string
}

export interface Shelter {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  capacity: number | null
  current_occ: number | null
  contact_name: string | null
  contact_phone: string | null
  status: string
  notes: string | null
  is_anchor: boolean
  created_at: string
  updated_at: string
}

export interface SupplyCenter {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  schedule: string | null
  accepts: string[] | null
  not_accepts: string[] | null
  contact_name: string | null
  contact_phone: string | null
  status: string
  notes: string | null
  is_anchor: boolean
  created_at: string
  updated_at: string
}

export interface Need {
  id: string
  needable_type: string
  needable_id: string
  item_name: string
  priority: NeedPriority
  qty_required: number
  qty_received: number
  unit: string
  pct_covered: number
  notes: string | null
  updated_at: string
  updated_by: string | null
}

export type CoordinatorSiteType = 'hospital' | 'supply_center'

export interface CoordinatorProfile {
  id: string
  auth_user_id: string
  site_type: CoordinatorSiteType
  site_id: string
  created_at: string
  updated_at: string
  site_name?: string
}

export interface NeedWithLocation extends Need {
  location_name: string
  location_type: CoordinatorSiteType | 'shelter'
}

export interface Report {
  id: string
  type: ReportType
  description: string
  person_id: string | null
  reported_by: string | null
  contact_info: string | null
  attachment_url: string | null
  status: ReportStatus
  reviewed_by: string | null
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Source {
  id: string
  name: string
  type: string
  confidence: ConfidenceLevel
  contact: string | null
  is_active: boolean
  created_at: string
}

export interface Update {
  id: string
  table_name: string
  record_id: string
  field: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string | null
  status: UpdateStatus
  reviewed_by: string | null
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export interface User {
  id: string
  auth_user_id: string | null
  email: string
  full_name: string | null
  phone: string | null
  role_id: string
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface Bulletin {
  id: string
  kind: BulletinKind
  title: string
  body: string
  source_name: string
  confidence: ConfidenceLevel
  is_published: boolean
  published_at: string
  created_at: string
}

export const STATUS_LABELS: Record<PersonStatus, string> = {
  safe: 'Sano y Salvo',
  injured: 'Lesionado',
  transferred: 'Trasladado',
  deceased: 'Fallecido',
  unknown: 'Sin Información',
}

export const STATUS_COLORS: Record<PersonStatus, string> = {
  safe: 'text-green-500',
  injured: 'text-yellow-500',
  transferred: 'text-blue-500',
  deceased: 'text-red-500',
  unknown: 'text-muted-foreground',
}

export const PRIORITY_LABELS: Record<NeedPriority, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
}

export const PRIORITY_COLORS: Record<NeedPriority, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-500 border-green-500/20',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  wrong_info: 'Información incorrecta',
  person_found: 'La persona ya apareció',
  person_transferred: 'La persona fue trasladada',
  hospital_changed: 'El hospital cambió',
  need_covered: 'La necesidad ya fue cubierta',
  other: 'Otro',
}
